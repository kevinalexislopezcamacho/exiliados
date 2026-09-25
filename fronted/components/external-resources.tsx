import { Card } from "@/components/ui/card"
import { ExternalLink, Trophy, Wrench } from "lucide-react"

const RESOURCES = [
  {
    name: "OSM Helper",
    description: "Calculadora y herramientas para Online Soccer Manager",
    url: "https://osmhelper.com/",
    icon: Wrench,
  },
  {
    name: "Foro Oficial OSM",
    description: "Noticias, información y torneos del juego",
    url: "https://forum.onlinesoccermanager.com/",
    icon: Trophy,
  },
]

export function ExternalResources() {
  return (
    <Card className="p-6 border-primary/20">
      <h3 className="font-bold text-lg mb-4 text-primary">Recursos Externos</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {RESOURCES.map((resource) => (
          <a
            key={resource.url}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 rounded-lg bg-card/50 border border-border/50 hover:border-primary/40 transition-colors p-4"
          >
            <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary">
              <resource.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                {resource.name}
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{resource.description}</p>
            </div>
          </a>
        ))}
      </div>
    </Card>
  )
}
