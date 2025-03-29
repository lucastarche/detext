// app/page.tsx
import { TextareaField } from "@/components/ui/textarea-field"

export default function HomePage() {
  return (
    <main className="max-w-2xl mx-auto mt-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Escribí tu texto</h1>
      <TextareaField
        label="Tu texto"
        placeholder="Escribí con tu propio estilo..."
        description="Este campo guarda tus ideas, pensamientos o tareas."
        fontSize="lg"
        rows={8}
      />
    </main>
  )
}
