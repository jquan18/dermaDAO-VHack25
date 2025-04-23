"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2 } from "lucide-react"

interface LoadingScreenProps {
  message?: string
  isLoading: boolean
  onComplete?: () => void
}

export default function LoadingScreen({ message = "Authenticating...", isLoading, onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0)
  const [currentMessage, setCurrentMessage] = useState(message)

  const messages = [
    message,
    "Connecting to blockchain...",
    "Initializing smart account...",
    "Generating wallet address...",
    "Verifying on-chain credentials...",
    "Preparing ERC-4337 bundler connection...",
    "Setting up account abstraction...",
    "Syncing with latest blockchain state...",
    "Checking gas estimations...",
    "Preparing your dashboard...",
    "Initializing smart contract interactions...",
    "Almost there...",
  ]

  useEffect(() => {
    if (!isLoading) {
      setProgress(100)
      const timeout = setTimeout(() => {
        onComplete?.()
      }, 500)
      return () => clearTimeout(timeout)
    }

    let interval: NodeJS.Timeout

    // Simulate progress
    if (progress < 90) {
      interval = setInterval(() => {
        setProgress((prev) => {
          const increment = Math.random() * 10
          const newProgress = Math.min(prev + increment, 90)
          return newProgress
        })
      }, 800)
    }

    // Cycle through messages
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => {
        const currentIndex = messages.indexOf(prev)
        const nextIndex = (currentIndex + 1) % messages.length
        return messages[nextIndex]
      })
    }, 2000)

    return () => {
      clearInterval(interval)
      clearInterval(messageInterval)
    }
  }, [isLoading, progress, onComplete])

  return (
    <AnimatePresence>
      {(isLoading || progress < 100) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-md px-8 py-12 space-y-8">
            <div className="space-y-2 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="flex justify-center"
              >
                <div className="relative">
                  <motion.div
                    animate={{
                      rotate: 360,
                    }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "linear",
                    }}
                  >
                    <Loader2 className="w-16 h-16 text-primary" />
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-8 h-8 bg-primary/20 rounded-full" />
                  </motion.div>
                </div>
              </motion.div>

              <motion.h3
                key={currentMessage}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-xl font-semibold tracking-tight text-black"
              >
                {currentMessage}
              </motion.h3>

              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 50, damping: 20 }}
                />
              </div>

              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                className="text-sm text-muted-foreground"
              >
                Please wait while we set things up for you
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="flex justify-center space-x-2"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                  className="w-2 h-2 rounded-full bg-primary"
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
