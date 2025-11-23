// src/pages/SignupPage.jsx (or similar)
import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/utils'

const SignupPage = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const response = await axios.post(`${serverUrl}/api/auth/signup`, {
        username,
        password,
      })
      const { token, ...userData } = response.data
      login(userData, token)
      navigate('/metaverse')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sign up.')
    }
  }

  return (
    <div className="min-h-screen relative bg-gradient-to-b from-[#14141a] via-[#0d0d14] to-black text-[#e6e7ea] overflow-hidden">
      {/* Floating blobs (same as HomePage/Login) */}
      <div aria-hidden className="pointer-events-none absolute -z-10 inset-0">
        <div className="absolute left-[-8rem] top-[-8rem] w-96 h-96 rounded-[40%_60%_60%_40%] bg-gradient-to-tr from-[#505081] to-[#7272e0] opacity-40 blur-[30px] animate-blob-slow" />
        <div className="absolute right-[-6rem] bottom-[-6rem] w-72 h-72 rounded-[30%_70%_70%_30%] bg-gradient-to-br from-[#44466f] to-[#8b8be0] opacity-35 blur-[28px] animate-blob-fast" />
      </div>

      {/* Shared-style header */}
      <Header />

      {/* Back link */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-24 md:pt-28">
        <Link
          to="/"
          className="inline-flex items-center text-xs md:text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span className="mr-1">&larr;</span> Back to Home
        </Link>
      </div>

      {/* Auth content */}
      <main className="relative z-10 flex items-center justify-center px-6 py-10 md:py-20">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 backdrop-blur-xl shadow-2xl p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Create an account
              <span className="text-[#9b99fe]">.</span>
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Join the Metaverse office and start collaborating in 3D spaces.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="block text-xs font-medium uppercase tracking-wide text-zinc-400"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#9b99fe] focus:ring-1 focus:ring-[#9b99fe] transition"
                  placeholder="choose_a_username"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium uppercase tracking-wide text-zinc-400"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#9b99fe] focus:ring-1 focus:ring-[#9b99fe] transition"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/70 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 justify-center text-sm font-medium"
              >
                Sign Up
              </Button>

              <p className="text-xs md:text-sm text-zinc-400 text-center mt-4">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-[#9b99fe] hover:text-[#b3b2ff] font-medium"
                >
                  Log in
                </Link>
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

export default SignupPage

// Same style header as LoginPage/HomePage
function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
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

        <div className="hidden md:flex items-center gap-3 text-sm">
          <span className="text-zinc-400">Already with us?</span>
          <Link
            to="/login"
            className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs hover:border-[#9b99fe] hover:text-[#9b99fe] transition"
          >
            Log in
          </Link>
        </div>
      </div>
    </header>
  )
}
