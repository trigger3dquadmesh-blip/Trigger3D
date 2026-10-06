import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../auth/useAuth.js'
import LandingFirearm from '../components/LandingFirearm.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import brandLogoLight from '../assets/landing/brand-logo-light.png'
import brandLogoDark from '../assets/landing/brand-logo-dark.png'
import sdg04 from '../assets/landing/sdg-04.png'
import sdg09 from '../assets/landing/sdg-09.png'
import sdg10 from '../assets/landing/sdg-10.png'
import stakeholderCriminology from '../assets/landing/stakeholder-criminology.png'
import stakeholderPsu from '../assets/landing/stakeholder-psu.png'
import member1 from '../assets/landing/team/member-1.jpg'
import member2 from '../assets/landing/team/member-2.jpg'
import member3 from '../assets/landing/team/member-3.jpg'
import member4 from '../assets/landing/team/member-4.jpg'

const goals = [
  ['04', 'Quality Education', '#ce1731', sdg04],
  ['09', 'Industry, Innovation, and Infrastructure', '#f36d21', sdg09],
  ['10', 'Reduced Inequalities', '#e40b7e', sdg10],
]

const features = [
  ['Interactive 3D Models', 'Rotate, zoom, and explore firearm models from different angles.', 'cube'],
  ['Component Familiarization', 'Select and highlight individual components to learn their names, locations, and functions.', 'layers'],
  ['Interactive Assessments', 'Test your understanding of firearm components through identification assessments.', 'target'],
  ['Progress Monitoring', 'Review assessment results and track learning performance over time.', 'chart'],
]

const teamMembers = [
  [member1, 'Arian Jane C. Agdoro', 'Tech Lead'],
  [member2, 'Stephanie Jane B. Cea', 'Documentation Lead'],
  [member3, 'Jeema M. Dometita', 'Data Lead'],
  [member4, 'Kristine Marie P. Fuentebella', 'Project Lead'],
]

const navigationLinks = [
  ['Home', '#top'],
  ['About', '#about'],
  ['Features', '#features'],
  ['Team', '#team'],
  ['Contact', '#contact'],
]

function FeatureIcon({ name }) {
  const common = { className: 'h-20 w-20 text-[var(--landing-text)]', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 1.7, viewBox: '0 0 24 24', 'aria-hidden': true }
  if (name === 'layers') return <svg {...common}><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></svg>
  if (name === 'target') return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>
  if (name === 'chart') return <svg {...common}><path d="M4 19V5M4 19h16" /><path d="m7 15 3-4 3 2 5-6" /><path d="M18 7h-3M18 7v3" /></svg>
  return <svg {...common}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>
}

function Brand({ large = false }) {
  return (
    <span className={`${large ? 'h-14 w-56' : 'h-11 w-40'} landing-brand-logo relative inline-block shrink-0`}>
      <img
        className="landing-brand-logo-light pointer-events-none h-full w-full object-contain object-left select-none"
        src={brandLogoLight}
        alt="Trigger3D - QuadMeshIT"
      />
      <img
        aria-hidden="true"
        className="landing-brand-logo-dark pointer-events-none h-full w-full object-contain object-left select-none"
        src={brandLogoDark}
        alt=""
      />
    </span>
  )
}

function SectionTitle({ id, children }) {
  return <h2 id={id} className="mb-12 text-center text-xl font-black uppercase tracking-[0.34em] md:text-2xl">{children}</h2>
}

const primaryButton = 'landing-primary-action rounded bg-[#109d1a] px-8 py-3 text-sm font-black text-white transition hover:bg-[#0c7d15] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#109d1a]'
const secondaryButton = 'rounded border border-[var(--landing-border)] px-8 py-3 text-sm font-black transition hover:border-[#109d1a] hover:text-[#109d1a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#109d1a]'
const navPrimaryButton = 'landing-primary-action rounded bg-[#109d1a] px-6 py-2 text-sm font-black text-white transition hover:bg-[#0c7d15] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#109d1a]'
const navSecondaryButton = 'rounded border border-[var(--landing-border)] px-6 py-2 text-sm font-black transition hover:border-[#109d1a] hover:text-[#109d1a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#109d1a]'
const fieldClass = 'rounded-lg border border-[var(--landing-border)] bg-[var(--landing-input)] px-4 py-3 text-[var(--landing-input-text)] outline-none placeholder:text-[var(--landing-placeholder)] focus:border-[#109d1a] focus:ring-2 focus:ring-[#109d1a]/30'

export default function HomePage() {
  const { loading, user } = useAuth()
  const [contactStatus, setContactStatus] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showHeroModel, setShowHeroModel] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  const landingScrollRef = useRef(null)
  const layoutModeRef = useRef(window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop')
  const accountPath = user ? '/account' : '/login'

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const update = () => setShowHeroModel(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    function handleViewportChange() {
      const nextMode = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop'
      if (nextMode === layoutModeRef.current) return
      layoutModeRef.current = nextMode
      const landingPage = landingScrollRef.current
      const previousScrollBehavior = landingPage?.style.scrollBehavior || ''
      if (landingPage) landingPage.style.scrollBehavior = 'auto'
      const resetLandingPosition = () => {
        if (landingPage) landingPage.scrollTop = 0
        window.scrollTo(0, 0)
      }
      resetLandingPosition()
      window.requestAnimationFrame(() => {
        resetLandingPosition()
        window.requestAnimationFrame(() => {
          resetLandingPosition()
          if (landingPage) landingPage.style.scrollBehavior = previousScrollBehavior
        })
      })
    }
    window.addEventListener('resize', handleViewportChange)
    return () => window.removeEventListener('resize', handleViewportChange)
  }, [])

  function handleContact(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const subject = String(form.get('subject') || 'Trigger3D inquiry')
    const message = String(form.get('message') || '')
    const sender = String(form.get('email') || '')
    window.location.href = `mailto:trigger3d.quadmeshit@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message}\n\nReply to: ${sender}`)}`
    setContactStatus('Your email application should open with the message prepared.')
  }

  return (
    <main className="landing-page landing-scroll min-h-screen overflow-x-hidden [overflow-anchor:none] bg-[var(--landing-bg)] text-[var(--landing-text)] md:h-screen md:overflow-y-auto md:scroll-smooth" ref={landingScrollRef}>
      <header className="sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[var(--landing-bg)]/95 backdrop-blur-md">
        <nav aria-label="Primary navigation" className="mx-auto flex h-16 w-[94%] max-w-[1600px] items-center justify-between gap-5">
          <a href="#top" aria-label="Trigger3D home" onClick={() => setMobileMenuOpen(false)}><Brand /></a>
          <div className="hidden items-center gap-6 lg:flex">
            {navigationLinks.map(([label, href]) => <a key={href} className="text-sm font-bold text-[var(--landing-muted)] transition hover:text-[#109d1a] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#109d1a]" href={href}>{label}</a>)}
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <ThemeToggle compact />
            <div className="hidden items-center gap-3 md:flex">
              {!loading && <Link className={navPrimaryButton} to={accountPath}>{user ? 'Open Account' : 'Login'}</Link>}
              {!loading && !user && <Link className={navSecondaryButton} to="/login?mode=signup">Sign Up</Link>}
            </div>
            <button className="grid h-10 w-10 place-items-center rounded border border-[var(--landing-border)] text-[var(--landing-text)] lg:hidden" type="button" aria-expanded={mobileMenuOpen} aria-controls="landing-mobile-menu" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => setMobileMenuOpen((open) => !open)}>
              <span className="text-xl leading-none" aria-hidden="true">{mobileMenuOpen ? '×' : '☰'}</span>
            </button>
          </div>
        </nav>
        {mobileMenuOpen && <div id="landing-mobile-menu" className="absolute left-0 right-0 top-full border-t border-[var(--landing-border)] bg-[var(--landing-bg)] px-6 py-4 shadow-md lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-2">
            {navigationLinks.map(([label, href]) => <a key={href} className="rounded px-3 py-2 font-bold text-[var(--landing-muted)] hover:bg-[var(--landing-card)] hover:text-[#109d1a]" href={href} onClick={() => setMobileMenuOpen(false)}>{label}</a>)}
            <div className="mt-2 flex gap-3 border-t border-[var(--landing-border)] pt-4 md:hidden">
              {!loading && <Link className={`${primaryButton} flex-1 text-center`} to={accountPath}>{user ? 'Open Account' : 'Login'}</Link>}
              {!loading && !user && <Link className={`${secondaryButton} flex-1 text-center`} to="/login?mode=signup">Sign Up</Link>}
            </div>
          </div>
        </div>
        }
      </header>

      <section id="top" className="landing-snap mx-auto grid w-[94%] max-w-[1600px] scroll-mt-16 items-center gap-[clamp(2rem,5vw,5rem)] py-[clamp(2.5rem,6vh,5rem)] md:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.85fr_1.15fr]">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-4 text-sm font-semibold tracking-wide text-[var(--landing-muted)]">Explore. Learn. Understand in 3D.</p>
          <h1 className="landing-hero-title font-black tracking-[-0.04em]">TRIGGER3D</h1>
          <p className="mt-7 max-w-xl text-[clamp(1rem,1.2vw,1.125rem)] leading-7 text-[var(--landing-muted)]">Trigger3D is a web-based interactive 3D firearm component visualization and assessment system designed for Criminology students.</p>
          <p className="mt-5 max-w-xl text-[clamp(1rem,1.2vw,1.125rem)] leading-7 text-[var(--landing-muted)]">Explore firearm components, learn their locations and functions, and test your knowledge through interactive assessments.</p>
          <div className="mt-9 flex flex-wrap gap-4">
            {!loading && <Link className={primaryButton} to={accountPath}>{user ? 'Open Account' : 'Sign In'}</Link>}
            <a className={secondaryButton} href="#contact">Contact Us</a>
          </div>
        </div>
        {showHeroModel && <div className="relative -translate-y-[clamp(2.5rem,6vh,3.125rem)] h-[clamp(24rem,68vh,42rem)] min-w-0">
          <span className="pointer-events-none absolute right-4 top-[54%] -translate-y-1/2 text-[clamp(4rem,7vw,7rem)] font-black leading-none tracking-[-0.08em] text-transparent opacity-60 [writing-mode:vertical-rl] [-webkit-text-stroke:2px_#109d1a]" aria-hidden="true">TRIGGER3D</span>
          <LandingFirearm />
        </div>}
      </section>

      <section id="about" className="landing-snap flex scroll-mt-16 flex-col justify-center py-[clamp(2.5rem,6vh,5rem)] md:min-h-[calc(100vh-4rem)]" aria-labelledby="sdg-heading">
      <div className="mx-auto w-[94%] max-w-[1600px]">
        <SectionTitle id="sdg-heading">SDG Goals</SectionTitle>
        <p className="mx-auto -mt-7 mb-[clamp(2rem,5vh,3.5rem)] max-w-3xl text-center text-[clamp(1rem,1.2vw,1.125rem)] leading-7 text-[var(--landing-muted)]">Trigger3D supports inclusive, technology-enabled learning by connecting interactive education with innovation and accessible training.</p>
        <div className="grid gap-14 pt-16 md:grid-cols-3 md:gap-[clamp(2rem,3vw,3rem)] md:pt-20 lg:gap-[clamp(2.5rem,3vw,3rem)]">
          {goals.map(([number, title, color, image]) => (
            <article key={number} className="relative flex min-h-60 flex-col items-center justify-start rounded-2xl bg-[var(--landing-card)] px-6 pb-6 pt-44 text-center shadow-md md:min-h-56 md:pt-34 lg:min-h-70 lg:justify-end lg:pb-8 lg:pt-36">
              <div className="absolute -top-8 grid aspect-[7/5] w-[min(15.5rem,calc(100%-2rem))] place-items-center rounded-xl text-white shadow-sm lg:-top-10 lg:h-50 lg:w-70" style={{ backgroundColor: color }}>
                <img className="h-full w-full rounded-xl object-contain p-[clamp(1rem,2.5vw,1.5rem)] lg:p-7" decoding="async" loading="lazy" src={image} alt="" /><span className="absolute right-3 top-2 text-xs font-black">{number}</span>
              </div>
              <h3 className="max-w-xs text-base font-black uppercase leading-6 tracking-wide">{title}</h3>
            </article>
          ))}
        </div>
      </div>
      </section>

      <section id="stakeholders" className="landing-snap flex scroll-mt-16 flex-col justify-center py-[clamp(2.5rem,6vh,5rem)] md:min-h-[calc(100vh-4rem)]" aria-labelledby="stakeholder-heading">
      <div className="mx-auto w-[90%] max-w-[1280px]">
        <SectionTitle id="stakeholder-heading">Stakeholders</SectionTitle>
        <p className="mx-auto -mt-7 mb-[clamp(2rem,5vh,3.5rem)] max-w-3xl text-center text-[clamp(1rem,1.2vw,1.125rem)] leading-7 text-[var(--landing-muted)]">Trigger3D is developed for the Partido State University community in collaboration with Criminology educators and learners.</p>
        <div className="grid gap-14 pt-12 md:grid-cols-2 md:gap-12 md:pt-14 lg:gap-16 lg:pt-10">
          {[[stakeholderPsu, 'Partido State University', 'Camarines Sur', 'lg:h-55 lg:w-55'], [stakeholderCriminology, 'BS in Criminology', 'College stakeholder', 'lg:h-52 lg:w-52']].map(([image, title, detail, desktopLogoSize]) => (
            <article key={title} className="relative flex min-h-56 flex-col items-center justify-start rounded-2xl bg-[var(--landing-card)] px-6 pb-6 pt-36 text-center shadow-md md:min-h-60 md:pt-40 lg:min-h-65 lg:justify-end lg:pb-10 lg:pt-40">
              <div className={`absolute -top-8 left-1/2 grid h-[clamp(9rem,22vw,12rem)] w-[clamp(9rem,22vw,12rem)] -translate-x-1/2 place-items-center lg:-top-15 ${desktopLogoSize}`}><img className="h-full w-full object-contain drop-shadow-[0_10px_10px_rgb(0_0_0/0.18)]" decoding="async" loading="lazy" src={image} alt="" /></div>
              <h3 className="font-black uppercase tracking-wide">{title}</h3><p className="mt-1 text-sm text-[var(--landing-muted)]">{detail}</p>
            </article>
          ))}
        </div>
      </div>
      </section>

      <section id="features" className="landing-snap mx-auto flex w-[94%] max-w-[1600px] scroll-mt-16 flex-col justify-center py-[clamp(2rem,5vh,4rem)] md:min-h-[calc(100vh-4rem)]" aria-labelledby="feature-heading">
        <SectionTitle id="feature-heading">Key Features</SectionTitle>
        <p className="mx-auto -mt-7 mb-[clamp(1.5rem,4vh,3rem)] max-w-3xl text-center text-[clamp(1rem,1.2vw,1.125rem)] leading-7 text-[var(--landing-muted)]">Explore the core tools that help students study firearm components, practice identification, and monitor their learning progress.</p>
        <div className="grid gap-7 lg:grid-cols-2">
          {features.map(([title, description, icon]) => (
            <article key={title} className="flex min-h-[clamp(9.5rem,23vh,13rem)] flex-col items-center gap-6 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-[clamp(1.25rem,2.5vw,2rem)] text-center shadow-md transition duration-200 hover:-translate-y-0.3 hover:border-[#109d1a] hover:shadow-[0_12px_24px_rgb(0_0_0/0.28)] md:flex-row md:text-left">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border border-[#109d1a]/40 bg-[#109d1a]/10">
                <FeatureIcon name={icon} />
              </div>
              <div>
                <h3 className="text-lg font-black">{title}</h3>
                <p className="mt-4 max-w-md leading-7 text-[var(--landing-muted)]">{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="team" className="landing-snap mx-auto flex w-[94%] max-w-[1500px] scroll-mt-16 flex-col justify-center py-[clamp(2rem,5vh,4rem)] md:min-h-[calc(100vh-4rem)]" aria-labelledby="team-heading">
        <SectionTitle id="team-heading">Meet the Team</SectionTitle>
        <p className="mx-auto -mt-5 mb-5 max-w-4xl text-center text-lg leading-7 text-[var(--landing-muted)]"><strong className="text-[var(--landing-text)]">Trigger3D</strong> is developed by <strong className="text-[var(--landing-text)]">Team QuadMeshIT</strong>, a group of student developers creating an interactive learning tool for Criminology education.</p>
        <aside className="mx-auto mb-5 flex max-w-5xl items-center justify-center gap-2 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-card)]/60 px-3 py-2 text-center text-xs leading-5 text-[var(--landing-muted)]" aria-label="Team photo safety disclaimer">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0 fill-none stroke-current stroke-2" viewBox="0 0 24 24"><path d="M12 9v4m0 3h.01M10.2 4.8 3.4 17a2 2 0 0 0 1.8 3h13.6a2 2 0 0 0 1.8-3L13.8 4.8a2 2 0 0 0-3.6 0Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <p className="m-0"><strong className="text-[var(--landing-text)]">Photo disclaimer:</strong> Firearm-like items shown are non-functional props used only for educational presentation.</p>
        </aside>
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {teamMembers.map(([image, name, role]) => 
          <article key={name} className="min-w-0 text-center">
            <div className="h-[clamp(16rem,44vh,30rem)] overflow-hidden rounded-2xl bg-[var(--landing-card)] shadow-md">
              <img className="h-full w-full object-cover object-center" decoding="async" loading="lazy" src={image} alt={name} />
            </div>
            <div className="flex min-h-20 flex-col items-center px-1 pt-5">
              <h3 className="max-w-full break-words text-sm font-black leading-5">{name}</h3>
              <p className="mt-1 max-w-full break-words text-xs leading-5 text-[var(--landing-muted)]">{role}</p>
            </div>
          </article>)}
        </div>
      </section>

      <section id="contact" className="landing-snap mx-auto flex w-[94%] max-w-[1600px] scroll-mt-16 flex-col justify-center border-t border-[var(--landing-border)] py-[clamp(2rem,5vh,4rem)] md:min-h-[calc(100vh-4rem)]" aria-labelledby="contact-heading">
        <SectionTitle id="contact-heading">Contact Us</SectionTitle>
        <p className="mx-auto -mt-5 mb-14 max-w-4xl text-center text-lg leading-7 text-[var(--landing-muted)]">Have questions, feedback, or concerns about Trigger3D? Send us a message and our team will get back to you as soon as possible.</p>
        <div className="mx-auto grid w-full max-w-6xl gap-[clamp(2rem,5vw,5rem)] lg:grid-cols-[0.75fr_1.25fr]">
          <div><Brand large /><h3 className="mt-10 text-sm font-black">Contact Information</h3><a className="mt-6 block text-sm text-[var(--landing-muted)] hover:text-[#109d1a]" href="mailto:trigger3d.quadmeshit@gmail.com">✉ &nbsp; trigger3d.quadmeshit@gmail.com</a><p className="mt-5 text-sm text-[var(--landing-muted)]">● &nbsp; Trigger3D</p></div>
          <form className="grid gap-5" onSubmit={handleContact}>
            <h3 className="text-sm font-black">Send Us a Message</h3>
            <div className="grid gap-5 md:grid-cols-2"><label className="sr-only" htmlFor="contact-name">Name</label><input className={fieldClass} id="contact-name" name="name" placeholder="Enter name here..." required /><label className="sr-only" htmlFor="contact-email">Email address</label><input className={fieldClass} id="contact-email" name="email" type="email" placeholder="Email Address" required /></div>
            <label className="sr-only" htmlFor="contact-subject">Subject</label><input className={fieldClass} id="contact-subject" name="subject" placeholder="Subject" required />
            <label className="sr-only" htmlFor="contact-message">Message</label><textarea className={`${fieldClass} min-h-44 resize-y`} id="contact-message" name="message" placeholder="Message" required />
            <button className={`${primaryButton} justify-self-center px-14`} type="submit">Submit</button>
            {contactStatus && <p className="text-center text-sm text-[#109d1a]" role="status">{contactStatus}</p>}
          </form>
        </div>
      </section>

      <footer className="px-6 pb-10 text-center text-sm text-[var(--landing-muted)]">© 2026 Trigger3D - QuadMeshIT. All rights reserved.</footer>
    </main>
  )
}
