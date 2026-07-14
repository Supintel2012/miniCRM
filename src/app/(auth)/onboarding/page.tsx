import { OnboardingForm } from '@/components/auth/OnboardingForm'
import { ThemeToggle } from '@/components/theme-toggle'

export default function OnboardingPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <span className="text-primary-foreground font-bold text-xl">m</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Welcome to miniCRM</h1>
          <p className="text-muted-foreground text-sm mt-1">Let&apos;s set up your workspace</p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  )
}
