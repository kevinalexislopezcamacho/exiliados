import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { StatsSection } from "@/components/stats-section"
import { AboutSection } from "@/components/about-section"
import { WarriorsSection } from "@/components/warriors-section"
import { CommunitySection } from "@/components/community-section"
import { CtaSection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="relative">
      <Navigation />
      <HeroSection />
      <StatsSection />
      <AboutSection />
      <div id="warriors">
        <WarriorsSection />
      </div>
      <div id="community">
        <CommunitySection />
      </div>
      <div id="join">
        <CtaSection />
      </div>
      <Footer />
    </main>
  )
}
