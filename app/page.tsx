"use client"

import { useState } from "react"
import { TextareaField } from "@/components/ui/textarea-field"
import { Button } from "@/components/ui/button"

type EventLogEntry = {
  timestamp: number
  type: "keypress" | "click" | "change"
  value?: string
  key?: string
  coords?: { x: number; y: number }
}

export default function HomePage() {
  const [text, setText] = useState("")
  const [events, setEvents] = useState<EventLogEntry[]>([])

  const logEvent = (entry: EventLogEntry) => {
    setEvents((prev) => [...prev, entry])
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setText(value)
    logEvent({
      timestamp: e.timeStamp,
      type: "change",
      value
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    logEvent({
      timestamp: e.timeStamp,
      type: "keypress",
      key: e.key
    })
  }

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    logEvent({
      timestamp: e.timeStamp,
      type: "click",
      coords: { x: e.clientX, y: e.clientY }
    })
  }

  const exportLog = () => {
    const json = JSON.stringify(events, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "event-log.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="max-w-2xl mx-auto mt-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Editor con seguimiento</h1>

      <TextareaField
        label="Tu texto"
        placeholder="Escribí con tu propio estilo..."
        description="Este campo guarda tus ideas, pensamientos o tareas."
        fontSize="lg"
        rows={8}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
      />

      <div className="mt-6">
        <Button onClick={exportLog}>📥 Exportar log en JSON</Button>
      </div>
    </main>
  )
}
