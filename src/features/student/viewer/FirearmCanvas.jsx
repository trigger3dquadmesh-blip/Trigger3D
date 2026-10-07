import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Html, OrbitControls, useBounds, useGLTF } from '@react-three/drei'
import { Box3, Color, Vector3 } from 'three'
import { gsap } from 'gsap'
import ViewerErrorBoundary from './ViewerErrorBoundary.jsx'

function BoundsController({ resetKey }) {
  const bounds = useBounds()

  useEffect(() => {
    const api = bounds.refresh()
    const { center, distance } = api.getSize()
    const startingPosition = center.clone().add(new Vector3(0, 0, distance))

    api
      .moveTo(startingPosition)
      .lookAt({ target: center })
      .clip()
  }, [bounds, resetKey])

  return null
}

function ExplosionBoundsController({ exploded, maxExplodeOrder }) {
  const bounds = useBounds()

  useEffect(() => {
    const animationTime = 800 + maxExplodeOrder * 120
    const timeout = window.setTimeout(() => {
      bounds.refresh().fit().clip()
    }, animationTime)

    return () => window.clearTimeout(timeout)
  }, [bounds, exploded, maxExplodeOrder])

  return null
}

function cloneMaterial(material) {
  return Array.isArray(material)
    ? material.map((item) => item.clone())
    : material.clone()
}

function materialList(material) {
  return Array.isArray(material) ? material : [material]
}

function FirearmModel({ url, components, selectedName, exploded, onLoaded, onSelect }) {
  const { scene } = useGLTF(url)
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

    copy.traverse((object) => {
      if (!object.isMesh) return
      object.material = cloneMaterial(object.material)
      object.userData.trigger3dOriginalPosition = object.position.clone()
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
        if (original.color && material.color) material.color.copy(original.color)
        if (original.emissive && material.emissive) material.emissive.copy(original.emissive)
        if (original.emissiveIntensity !== undefined) {
          material.emissiveIntensity = original.emissiveIntensity
        }

        if (object.name === selectedName) {
          if (material.color) material.color.lerp(new Color('#68d391'), 0.65)
          if (material.emissive) material.emissive.set('#14532d')
          if (material.emissiveIntensity !== undefined) material.emissiveIntensity = 0.8
        }
      })
    })
  }, [model, selectedName])

  useEffect(() => {
    model.updateWorldMatrix(true, true)
    const modelBox = new Box3().setFromObject(model)
    const modelCenter = modelBox.getCenter(new Vector3())
    const modelSize = modelBox.getSize(new Vector3())
    const modelScale = Math.max(modelSize.x, modelSize.y, modelSize.z)
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

    model.traverse((object) => {
      if (object.isMesh) meshes.push(object)
    })

    meshes.forEach((object, meshIndex) => {
      const originalPosition = object.userData.trigger3dOriginalPosition
      let targetPosition = originalPosition.clone()
      const layout = componentLayout.get(object.name)

      if (exploded) {
        object.geometry.computeBoundingBox()
        const localCenter = object.geometry.boundingBox.getCenter(new Vector3())
        const originalWorldCenter = object.localToWorld(localCenter.clone())
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

  useEffect(() => () => {
    model.traverse((object) => {
      if (!object.isMesh) return
      materialList(object.material).forEach((material) => material.dispose())
    })
  }, [model])

  return (
    <primitive
      object={model}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect(event.object.name)
      }}
    />
  )
}

export default function FirearmCanvas({
  modelUrl,
  components,
  selectedName,
  exploded,
  resetKey,
  onSelect,
}) {
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

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
    <div className="viewer-canvas">
      <ViewerErrorBoundary resetKey={modelUrl}>
        <Canvas
          camera={{ position: [0, 0, 8], fov: 45 }}
          dpr={[1, 2]}
          onPointerMissed={() => onSelect(null)}
        >
          <color attach="background" args={['#090d11']} />
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
                onLoaded={() => { setLoaded(true); setTimedOut(false) }}
                onSelect={onSelect}
              />
              <BoundsController resetKey={resetKey} />
              <ExplosionBoundsController
                exploded={exploded}
                maxExplodeOrder={Math.max(
                  0,
                  ...components.map((component) => Number(component.explode_order) || 0),
                )}
              />
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
