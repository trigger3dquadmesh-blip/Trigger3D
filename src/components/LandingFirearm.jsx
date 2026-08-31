import heroFirearm from '../assets/landing/hero-firearm.png'

export default function LandingFirearm() {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center" aria-label="Trigger3D firearm model">
        <img className="max-h-full w-full scale-[1.18] object-contain drop-shadow-[0_24px_22px_rgb(0_0_0/0.42)]" src={heroFirearm} alt="M1911 firearm model" />
    </div>
  )
}
