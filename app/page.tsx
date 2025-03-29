"use client"

import { useEffect, useRef, useState } from "react"
import { TextareaField } from "@/components/ui/textarea-field"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  const [text, setText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Arrays para guardar datos por cada 100ms
  const [keystrokes, setKeystrokes] = useState<number[]>([])
  const [backspaces, setBackspaces] = useState<number[]>([])

  // Refs para contar en cada intervalo
  const keystrokesRef = useRef(0)
  const backspaceRef = useRef(0)

  useEffect(() => {
    // Escuchar teclas globalmente
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === textareaRef.current) {
        if (e.key === "Backspace") {
          backspaceRef.current += 1
        } else {
          keystrokesRef.current += 1
        }
      }
    }

    const interval = setInterval(() => {
      setKeystrokes((prev) => [...prev, keystrokesRef.current])
      setBackspaces((prev) => [...prev, backspaceRef.current])
    }, 100)

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      clearInterval(interval)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const exportCSV = () => {
    const maxLength = Math.max(
      keystrokes.length,
      backspaces.length,
    )

    const pad = (arr: number[]) =>
      Array.from({ length: maxLength }, (_, i) => arr[i] ?? "")

    const rows = [
      pad(keystrokes),
      pad(backspaces),
    ]

    const csv = rows.map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "activity-log.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="max-w-2xl mx-auto mt-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Seguimiento cada 100ms</h1>

      <TextareaField
        ref={textareaRef}
        placeholder="Escribí acá..."
        fontSize="lg"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="mt-6">
        <Button onClick={exportCSV}>📥 Exportar CSV</Button>
      </div>
    </main>
  )
}
