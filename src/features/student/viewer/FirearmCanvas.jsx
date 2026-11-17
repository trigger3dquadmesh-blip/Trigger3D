import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bounds, Html, OrbitControls, useBounds, useGLTF } from '@react-three/drei'
import { Box3, Color, Quaternion, Vector3 } from 'three'
import { gsap } from 'gsap'
import ViewerErrorBoundary from './ViewerErrorBoundary.jsx'

function BoundsController({ resetKey }) {
  const bounds = useBounds()

  useEffect(() => {
    try {
      const api = bounds.refresh()
      const { center, distance } = api.getSize()
      if (
        !center
        || ![center.x, center.y, center.z, distance].every(Number.isFinite)
        || distance <= 0
      ) return
      const startingPosition = center.clone().add(new Vector3(0, 0, distance))

      api
        .moveTo(startingPosition)
        .lookAt({ target: center })
        .clip()
    } catch (error) {
      console.warn('Could not frame the firearm model.', error)
    }
  }, [bounds, resetKey])

  return null
}

// Backdrop behind the 3D scene follows the site theme: a light gray studio
// gradient in light mode, a soft dark gradient in dark mode. The colors live
// in index.css (--viewer-backdrop). The 3D canvas itself is transparent, so
// this CSS background shows through.
const VIEWER_BACKGROUND = 'var(--viewer-backdrop)'

const GLIDE_SECONDS = 0.9
// How far back the camera sits from a focused part (1 = tight fit). Small
// parts get more room so they don't fill the screen; big parts get a tight
// fit so they don't look far away. Sizes are fractions of the whole gun.
const SMALL_PART_PADDING = 1.8
const LARGE_PART_PADDING = 1.0
const SMALL_PART_SIZE = 0.1
const LARGE_PART_SIZE = 0.4

function partPadding(sizeRatio) {
  const t = (sizeRatio - SMALL_PART_SIZE) / (LARGE_PART_SIZE - SMALL_PART_SIZE)
  const clamped = Math.min(1, Math.max(0, t))
  return SMALL_PART_PADDING + (LARGE_PART_PADDING - SMALL_PART_PADDING) * clamped
}

// Smoothly moves the camera so it looks at `endTarget` from `endDistance`,
// always keeping the current viewing angle (it never turns on its own).
// Distance is interpolated on a log scale so zooming changes the apparent
// size at an even rate instead of lurching at the start. Returns the gsap
// tween so it can be cancelled.
function glideCamera(camera, controls, endTarget, endDistance) {
  const startTarget = controls?.target?.clone() ?? endTarget.clone()
  const offset = camera.position.clone().sub(startTarget)
  const startDistance = offset.length() > 0.000001 ? offset.length() : endDistance
  const direction = offset.length() > 0.000001 ? offset.normalize() : new Vector3(0, 0, 1)
  const logStart = Math.log(startDistance)
  const logEnd = Math.log(endDistance)
  const currentTarget = new Vector3()

  // Keep both ends of the trip inside the clipping range while moving.
  camera.near = Math.min(camera.near, Math.min(startDistance, endDistance) / 100)
  camera.far = Math.max(camera.far, Math.max(startDistance, endDistance) * 100)
  camera.updateProjectionMatrix()

  const progress = { value: 0 }
  return gsap.to(progress, {
    value: 1,
    duration: GLIDE_SECONDS,
    ease: 'power2.inOut',
    onUpdate: () => {
      currentTarget.lerpVectors(startTarget, endTarget, progress.value)
      const distance = Math.exp(logStart + (logEnd - logStart) * progress.value)
      camera.position.copy(currentTarget).addScaledVector(direction, distance)
      if (controls) {
        controls.target.copy(currentTarget)
        controls.update()
      } else {
        camera.lookAt(currentTarget)
      }
    },
    onComplete: () => {
      camera.near = endDistance / 100
      camera.far = endDistance * 100
      camera.updateProjectionMatrix()
    },
  })
}

// In explode view the selected part slowly turns in place around the vertical
// axis so every side can be seen without dragging. Set to false to turn off.
const SPIN_SELECTED_PART = true
const SPIN_SECONDS_PER_TURN = 10
const SPIN_RAMP_SECONDS = 0.8 // eases the spin in instead of starting abruptly
const SPIN_RETURN_RATE = 5 // how fast a released part eases back to straight
const FULL_TURN = Math.PI * 2
const spinTurn = new Quaternion()
const spinOffset = new Vector3()
const worldUp = new Vector3(0, 1, 0)

// Captures what is needed to turn `object` around its own center (not its
// pivot, which for most models sits at the gun's center).
function createSpin(object) {
  object.updateWorldMatrix(true, false)
  const parentRotation = object.parent.getWorldQuaternion(new Quaternion()).invert()
  return {
    object,
    angle: 0,
    speed: 0,
    axis: worldUp.clone().applyQuaternion(parentRotation).normalize(),
    baseQuaternion: object.quaternion.clone(),
    basePosition: object.position.clone(),
    // Vector from the pivot to the part's center, in the parent's space.
    centerOffset: object.userData.trigger3dLocalCenter.clone()
      .multiply(object.scale)
      .applyQuaternion(object.quaternion),
  }
}

// Turns the part by `spin.angle` while keeping its center where it was.
function applySpin(spin) {
  spinTurn.setFromAxisAngle(spin.axis, spin.angle)
  spin.object.quaternion.copy(spinTurn).multiply(spin.baseQuaternion)
  spinOffset.copy(spin.centerOffset).applyQuaternion(spinTurn)
  spin.object.position.copy(spin.basePosition).add(spin.centerOffset).sub(spinOffset)
}

function restoreSpin(spin) {
  spin.object.quaternion.copy(spin.baseQuaternion)
  spin.object.position.copy(spin.basePosition)
}

function cloneMaterial(material) {
  if (!material) return material
  return Array.isArray(material)
    ? material.filter(Boolean).map((item) => item.clone?.() ?? item)
    : material.clone?.() ?? material
}

function materialList(material) {
  if (!material) return []
  return Array.isArray(material) ? material.filter(Boolean) : [material]
}

function FirearmModel({ url, components, selectedName, exploded, onLoaded, onSelect }) {
  const { scene } = useGLTF(url)
  const bounds = useBounds()
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const glideRef = useRef(null)
  // Time (performance.now) when the current explode/collapse animation ends.
  const settleAtRef = useRef(0)
  // What the camera last framed, so selection changes only move it when needed.
  const framedRef = useRef({ exploded: null, target: null })
  // The part spinning now, and parts easing back to straight after release.
  const spinRef = useRef(null)
  const returningSpinsRef = useRef([])
  const componentLayout = useMemo(
    () => new Map(components.map((component) => [component.mesh_name, component])),
    [components],
  )
  const model = useMemo(() => {
    const copy = scene.clone(true)

    // Some imported firearm models (including the bundled M1911) use Z as
    // their vertical axis. The viewer camera looks along Z, so those models
    // otherwise appear edge-on and effectively invisible. Rotate only models
    // whose Y dimension is exceptionally thin; normally oriented uploads are
    // left untouched.
    copy.updateWorldMatrix(true, true)
    const sourceSize = new Box3().setFromObject(copy).getSize(new Vector3())
    const largestDimension = Math.max(sourceSize.x, sourceSize.y, sourceSize.z)
    if (largestDimension > 0 && sourceSize.y <= largestDimension * 0.01 && sourceSize.z > sourceSize.y) {
      copy.rotation.x = Math.PI / 2
      copy.updateWorldMatrix(true, true)
    }

    // Measure the assembled ("rest") pose once, here, before anything moves.
    // Explode distances are based on these numbers, so toggling while parts
    // are still in motion can never push them further out than intended.
    const restBox = new Box3().setFromObject(copy)
    const restSize = restBox.getSize(new Vector3())
    const restScale = Math.max(restSize.x, restSize.y, restSize.z)
    copy.userData.trigger3dRest = {
      center: restBox.getCenter(new Vector3()),
      scale: Number.isFinite(restScale) && restScale > 0 ? restScale : 1,
    }

    copy.traverse((object) => {
      if (!object.isMesh) return
      const clonedMaterial = cloneMaterial(object.material)
      if (clonedMaterial) object.material = clonedMaterial
      object.userData.trigger3dOriginalPosition = object.position.clone()
      object.geometry?.computeBoundingBox?.()
      const localCenter = object.geometry?.boundingBox
        ? object.geometry.boundingBox.getCenter(new Vector3())
        : new Vector3()
      object.userData.trigger3dLocalCenter = localCenter.clone()
      object.userData.trigger3dRestWorldCenter = object.localToWorld(localCenter)
      object.userData.trigger3dMaterials = materialList(object.material).map((material) => ({
        color: material.color?.clone() ?? null,
        emissive: material.emissive?.clone() ?? null,
        emissiveIntensity: material.emissiveIntensity,
      }))
    })

    return copy
  }, [scene])

  useEffect(() => {
    onLoaded()
  }, [model, onLoaded])

  useEffect(() => {
    model.traverse((object) => {
      if (!object.isMesh) return

      materialList(object.material).forEach((material, index) => {
        const original = object.userData.trigger3dMaterials[index]
        if (!original) return
        if (original.color && material.color) material.color.copy(original.color)
        if (original.emissive && material.emissive) material.emissive.copy(original.emissive)
        if (original.emissiveIntensity !== undefined) {
          material.emissiveIntensity = original.emissiveIntensity
        }

        // Assembled view only: a strong green tint makes the selected part easy
        // to spot inside the gun. In explode view the camera zooms in on the
        // part (and it spins), so it keeps its real colors and texture.
        if (object.name !== selectedName || exploded) return
        if (material.color) material.color.lerp(new Color('#68d391'), 0.65)
        if (material.emissive) material.emissive.set('#14532d')
        if (material.emissiveIntensity !== undefined) material.emissiveIntensity = 0.8
      })
    })
  }, [exploded, model, selectedName])

  useEffect(() => {
    // Straighten any spinning part before parts start moving, so a part never
    // goes back into the gun turned.
    if (spinRef.current) restoreSpin(spinRef.current)
    returningSpinsRef.current.forEach(restoreSpin)
    spinRef.current = null
    returningSpinsRef.current = []

    model.updateWorldMatrix(true, true)
    // Use the assembled pose measured at load time, never the current pose:
    // mid-animation the model is spread out and would measure too large.
    const { center: modelCenter, scale: modelScale } = model.userData.trigger3dRest
    const explosionDistance = modelScale * 0.65
    const hasConfiguredLayout = components.some((component) => (
      component.assembly_group !== 'ungrouped'
      || Math.abs(Number(component.explode_x)) > 0.000001
      || Math.abs(Number(component.explode_y)) > 0.000001
      || Math.abs(Number(component.explode_z)) > 0.000001
    ))
    const maxExplodeOrder = Math.max(
      0,
      ...components.map((component) => Number(component.explode_order) || 0),
    )
    const meshes = []
    settleAtRef.current = performance.now() + 800 + maxExplodeOrder * 120

    model.traverse((object) => {
      if (object.isMesh) meshes.push(object)
    })

    meshes.forEach((object, meshIndex) => {
      const originalPosition = object.userData.trigger3dOriginalPosition?.clone?.()
        ?? object.position.clone()
      let targetPosition = originalPosition.clone()
      const layout = componentLayout.get(object.name)

      if (exploded && object.geometry && object.parent) {
        const originalWorldCenter = object.userData.trigger3dRestWorldCenter.clone()
        let worldOffset

        if (hasConfiguredLayout && layout) {
          worldOffset = new Vector3(
            Number(layout.explode_x),
            Number(layout.explode_y),
            Number(layout.explode_z),
          ).multiplyScalar(modelScale)
        } else {
          const outwardDirection = originalWorldCenter.clone().sub(modelCenter)
          const angle = meshIndex * 2.399963
          const spreadDirection = new Vector3(
            Math.cos(angle),
            Math.sin(angle),
            ((meshIndex % 5) - 2) * 0.08,
          )

          if (outwardDirection.lengthSq() > 0.000001) outwardDirection.normalize()

          const direction = spreadDirection
            .multiplyScalar(0.9)
            .addScaledVector(outwardDirection, 0.35)
            .normalize()
          const distanceMultiplier = 0.9 + (meshIndex % 4) * 0.12
          worldOffset = direction.multiplyScalar(explosionDistance * distanceMultiplier)
        }

        const targetWorldCenter = originalWorldCenter.clone().add(worldOffset)
        const parentTarget = object.parent.worldToLocal(targetWorldCenter)
        const parentOriginal = object.parent.worldToLocal(originalWorldCenter.clone())
        targetPosition = originalPosition.clone().add(parentTarget.sub(parentOriginal))
      }

      const explodeOrder = Number(layout?.explode_order) || 0
      const delay = hasConfiguredLayout
        ? (exploded ? explodeOrder : maxExplodeOrder - explodeOrder) * 0.12
        : 0

      gsap.to(object.position, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: 0.7,
        delay,
        ease: 'power2.inOut',
      })

    })

    return () => {
      model.traverse((object) => {
        if (object.isMesh) gsap.killTweensOf(object.position)
      })
    }
  }, [componentLayout, components, exploded, model])

  // Camera framing. Explode/collapse frames the whole model once the parts
  // settle. In explode view, selecting a part glides the camera to that part
  // (no isolation: every part stays visible and the controls stay free), and
  // clearing the selection glides back out to the whole model.
  useEffect(() => {
    const part = exploded && selectedName ? model.getObjectByName(selectedName) : null
    const target = part ?? model
    const framed = framedRef.current
    if (framed.exploded === exploded && framed.target === target) return

    const wait = Math.max(0, settleAtRef.current - performance.now())
    const timeout = window.setTimeout(() => {
      try {
        const { center, size, distance: fitDistance } = bounds.refresh(target).getSize()
        let distance = fitDistance
        if (part) {
          const sizeRatio = Math.max(size.x, size.y, size.z) / model.userData.trigger3dRest.scale
          distance = fitDistance * partPadding(sizeRatio)
        }
        if (
          !center
          || ![center.x, center.y, center.z, distance].every(Number.isFinite)
          || distance <= 0
        ) return
        glideRef.current?.kill()
        glideRef.current = glideCamera(camera, controls, center, distance)
        // Only the whole-model view sets the scroll-out limit, so zooming
        // into a small part never traps the user close to it.
        if (target === model && controls) controls.maxDistance = distance * 10
        framedRef.current = { exploded, target }
      } catch (error) {
        console.warn('Could not frame the firearm viewer camera.', error)
      }
    }, wait)

    return () => window.clearTimeout(timeout)
  }, [bounds, camera, controls, exploded, model, selectedName])

  // Grabbing the controls mid-glide hands the camera straight back to the
  // user; unmounting stops any glide still running.
  useEffect(() => {
    const stopGlide = () => glideRef.current?.kill()
    controls?.addEventListener?.('start', stopGlide)
    return () => {
      controls?.removeEventListener?.('start', stopGlide)
      stopGlide()
    }
  }, [controls])

  // In explode view, start the selected part spinning once the parts have
  // settled. When it is released (another part, click away, reassemble) it
  // is handed to the "returning" list and eases back to straight.
  useEffect(() => {
    if (!SPIN_SELECTED_PART || !exploded || !selectedName) return undefined
    const part = model.getObjectByName(selectedName)
    if (!part?.isMesh || !part.parent) return undefined

    let spin = null
    const wait = Math.max(0, settleAtRef.current - performance.now())
    const timeout = window.setTimeout(() => {
      // Picking a part again while it is still easing back carries on from
      // its current angle instead of measuring it while turned.
      const returning = returningSpinsRef.current.find((item) => item.object === part)
      returningSpinsRef.current = returningSpinsRef.current.filter((item) => item !== returning)
      spin = returning ?? createSpin(part)
      spinRef.current = spin
    }, wait)

    return () => {
      window.clearTimeout(timeout)
      if (!spin) return
      if (spinRef.current === spin) spinRef.current = null
      returningSpinsRef.current.push(spin)
    }
  }, [exploded, model, selectedName])

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1) // avoid a jump after the tab was hidden
    const spin = spinRef.current
    if (spin) {
      spin.speed = Math.min(1, spin.speed + step / SPIN_RAMP_SECONDS)
      spin.angle = (spin.angle + spin.speed * (FULL_TURN / SPIN_SECONDS_PER_TURN) * step) % FULL_TURN
      applySpin(spin)
    }
    if (returningSpinsRef.current.length === 0) return
    returningSpinsRef.current = returningSpinsRef.current.filter((item) => {
      // Ease back the short way round.
      let angle = item.angle % FULL_TURN
      if (angle > Math.PI) angle -= FULL_TURN
      if (angle < -Math.PI) angle += FULL_TURN
      angle -= angle * Math.min(1, step * SPIN_RETURN_RATE)
      item.angle = angle
      item.speed = 0
      if (Math.abs(angle) < 0.002) {
        restoreSpin(item)
        return false
      }
      applySpin(item)
      return true
    })
  })

  // Leaving the viewer straightens every part.
  useEffect(() => () => {
    if (spinRef.current) restoreSpin(spinRef.current)
    returningSpinsRef.current.forEach(restoreSpin)
  }, [model])

  useEffect(() => () => {
    model.traverse((object) => {
      if (!object.isMesh) return
      materialList(object.material).forEach((material) => material.dispose?.())
    })
  }, [model])

  return (
    <primitive
      object={model}
      onClick={(event) => {
        event.stopPropagation()
        // Ignore clicks that were really a drag to orbit the camera.
        if (event.delta > 4) return
        onSelect?.(event.object.name)
      }}
    />
  )
}

export default function FirearmCanvas({
  modelUrl,
  components = [],
  selectedName,
  exploded,
  resetKey,
  onSelect,
}) {
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const handleModelLoaded = useCallback(() => {
    setLoaded(true)
    setTimedOut(false)
  }, [])

  useEffect(() => {
    // A new signed URL or retry starts a fresh, bounded loading attempt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false)
    setTimedOut(false)
    const timeout = window.setTimeout(() => setTimedOut(true), 30_000)
    return () => window.clearTimeout(timeout)
  }, [modelUrl, retryKey])

  function retryModel() {
    useGLTF.clear(modelUrl)
    setRetryKey((value) => value + 1)
  }

  return (
    <div className="viewer-canvas" style={{ background: VIEWER_BACKGROUND }}>
      <ViewerErrorBoundary onRetry={retryModel} resetKey={`${modelUrl}:${retryKey}`}>
        <Canvas
          key={`${modelUrl}:${retryKey}`}
          camera={{ position: [0, 0, 8], fov: 45 }}
          dpr={[1, 2]}
          onPointerMissed={() => onSelect?.(null)}
        >
          <ambientLight intensity={1.8} />
          <directionalLight position={[5, 8, 6]} intensity={3} />
          <directionalLight position={[-4, 2, -3]} intensity={1.5} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
          <Bounds observe margin={1.35}>
            <Suspense fallback={<Html center><span className="canvas-loader">Loading model...</span></Html>}>
              <FirearmModel
                key={`${modelUrl}:${retryKey}`}
                url={modelUrl}
                components={components}
                selectedName={selectedName}
                exploded={exploded}
                onLoaded={handleModelLoaded}
                onSelect={onSelect}
              />
              <BoundsController resetKey={resetKey} />
            </Suspense>
          </Bounds>
        </Canvas>
      </ViewerErrorBoundary>
      {!loaded && !timedOut && (
        <div className="viewer-model-loading" role="status" aria-live="polite" aria-label="Loading 3D model">
          <span className="viewer-model-loading-spinner" aria-hidden="true" />
          <strong>Loading 3D model…</strong>
          <span>Please wait while the model is prepared.</span>
        </div>
      )}
      {!loaded && timedOut && <div className="viewer-load-timeout" role="alert"><strong>The 3D model is taking too long to load.</strong><span>Check your connection, then try downloading the model again.</span><button onClick={retryModel} type="button">Retry model</button></div>}
    </div>
  )
}
