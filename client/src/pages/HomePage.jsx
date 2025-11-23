// src/components/HeroPage.jsx
import React from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import AnimatedGroup from '../components/ui/AnimatedGroup'         // fixed path
import { Button } from '../components/ui/Button'                    // fixed path
import { cn } from '../lib/utils'                                   // fixed path 

export default function HomePage() {
  return (
    <div className="min-h-screen relative bg-gradient-to-b from-[#14141a] via-[#0d0d14] to-black text-[#e6e7ea] overflow-hidden">
      {/* Floating blobs */}
      <div aria-hidden className="pointer-events-none absolute -z-10 inset-0">
        <div className="absolute left-[-8rem] top-[-8rem] w-96 h-96 rounded-[40%_60%_60%_40%] bg-gradient-to-tr from-[#505081] to-[#7272e0] opacity-40 blur-[30px] animate-blob-slow" />
        <div className="absolute right-[-6rem] bottom-[-6rem] w-72 h-72 rounded-[30%_70%_70%_30%] bg-gradient-to-br from-[#44466f] to-[#8b8be0] opacity-35 blur-[28px] animate-blob-fast" />
      </div>

      <Header />

      {/* Hero main */}
      <main className="relative z-10">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-36">
          <div className="text-center lg:text-left lg:flex lg:items-center lg:gap-12">
            <div className="lg:flex-1">
              <AnimatedGroup
                className="space-y-6"
                variants={{
                  container: {
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.08, delayChildren: 0.3 },
                    },
                  },
                  item: {
                    hidden: { opacity: 0, y: 16 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { type: 'spring', bounce: 0.2, duration: 1.2 },
                    },
                  },
                }}
              >
                <h1 className="mx-auto max-w-3xl text-4xl md:text-6xl font-extrabold leading-tight">
                  Metaverse for{' '}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#9b99fe] to-[#2bc8b7]">
                    Remote Collaborations
                  </span>
                </h1>

                <p className="mx-auto max-w-2xl text-lg text-zinc-300">
                  Build collaborative virtual spaces and modern web experiences with composable UI,
                  realtime features, and tools that fit your workflow.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-start sm:items-center">
                  <div className="rounded-xl bg-gradient-to-b from-white/90 to-white/80 p-0.5 inline-block">
                    <Button as="link" to="/signup" variant="primary" className="px-6">
                      Get Started
                    </Button>
                  </div>
                </div>
              </AnimatedGroup>
            </div>

            {/* Right-side preview card */}
            <AnimatedGroup
              className="mt-12 lg:mt-0 lg:w-1/2"
              variants={{
                container: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
                item: { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } },
              }}
            >
              <div className="relative mx-auto max-w-3xl lg:mx-0 lg:max-w-none">
                <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/60 to-transparent p-3 shadow-lg">
                  <img
                    src="/assets/screenshot.png"
                    alt="app preview"
                    className="hidden dark:block w-full rounded-xl object-cover"
                  />
                  <img
                    src="/assets/screenshot.png"
                    alt="app preview light"
                    className="block dark:hidden w-full rounded-xl object-cover"
                  />
                </div>
              </div>
            </AnimatedGroup>
          </div>
        </div>

        {/* Customers / logos row */}
        <section className="bg-zinc-900/60 py-10 mt-8">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <div className="mb-6 text-sm">Trusted by</div>
            <div className="grid grid-cols-4 gap-8 items-center justify-center sm:grid-cols-8">
              {[
                'https://html.tailus.io/blocks/customers/nvidia.svg',
                'https://html.tailus.io/blocks/customers/column.svg',
                'https://html.tailus.io/blocks/customers/github.svg',
                'https://html.tailus.io/blocks/customers/nike.svg',
                'https://html.tailus.io/blocks/customers/lemonsqueezy.svg',
                'https://html.tailus.io/blocks/customers/laravel.svg',
                'https://html.tailus.io/blocks/customers/lilly.svg',
                'https://html.tailus.io/blocks/customers/openai.svg',
              ].map((src, i) => (
                <div key={i} className="flex items-center justify-center">
                  <img
                    src={src}
                    alt={`logo-${i}`}
                    className="h-6 object-contain invert dark:invert-0"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function Header() {
  const [open, setOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed top-4 left-0 right-0 z-30 px-4">
      <div
        className={cn(
          'mx-auto max-w-7xl flex items-center justify-between gap-4 rounded-2xl transition-all duration-200 border p-3',
          scrolled
            ? 'bg-zinc-900/70 border-zinc-800 shadow-lg'
            : 'bg-zinc-900/35 border-zinc-700/70'
        )}
      >
        {/* Logo / brand - properly aligned */}
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#9b99fe] to-[#2bc8b7] shadow-md">
            <span className="text-sm font-bold text-black">M</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide">Metaverse</span>
            <span className="text-[10px] text-zinc-400 hidden sm:block">
              Remote Collaboration
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-6">
          <a href="#features" className="text-sm text-zinc-300 hover:text-white">
            Features
          </a>
          <a href="#solution" className="text-sm text-zinc-300 hover:text-white">
            Solution
          </a>
          <a href="#pricing" className="text-sm text-zinc-300 hover:text-white">
            Pricing
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <Link to="/login" className="text-sm text-zinc-200 hover:text-white">
              Login
            </Link>
          </div>
          <div className="hidden md:block">
            <Button as="link" to="/signup" variant="primary" className="px-4 py-1 text-sm">
              Sign up
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((prev) => !prev)}
            className="block lg:hidden p-2 rounded-md bg-zinc-800/40 border border-zinc-700"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="mt-2 mx-auto max-w-7xl rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4 lg:hidden">
          <ul className="flex flex-col gap-3 text-sm">
            <li>
              <a href="#features" onClick={() => setOpen(false)}>
                Features
              </a>
            </li>
            <li>
              <a href="#solution" onClick={() => setOpen(false)}>
                Solution
              </a>
            </li>
            <li>
              <a href="#pricing" onClick={() => setOpen(false)}>
                Pricing
              </a>
            </li>
            <li className="mt-2">
              <Link to="/login" onClick={() => setOpen(false)} className="block">
                Login
              </Link>
            </li>
            <li>
              <Link to="/signup" onClick={() => setOpen(false)} className="block">
                Sign Up
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
