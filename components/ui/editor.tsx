'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RefreshCw, Book, FileText, Trash2, Download, BrainCircuit, Loader2 } from 'lucide-react'

interface Reference {
  id: string
  text: string
  citation: string
}

interface Question {
  id: string
  text: string
}

export function Editor() {
  const charAmount = useRef(0)
  const backspaceAmount = useRef(0)

  const charSeries = useRef<number[]>([])
  const backspaceSeries = useRef<number[]>([])

  const [references, setReferences] = useState<Reference[]>([])
  const [selectedText, setSelectedText] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [citation, setCitation] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const oldTextLength = useRef(0)

  const [questions, setQuestions] = useState<Question[]>([])
  const [isQuestionsDialogOpen, setIsQuestionsDialogOpen] = useState(false)
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)

  // Clear document function
  const handleClearDocument = () => {
    charAmount.current = backspaceAmount.current = 0;
    charSeries.current = [];
    backspaceSeries.current = [];
    if (editorRef.current) {
      editorRef.current.innerHTML = ''
      editorRef.current.focus()
      setReferences([]) // Clear references when document is cleared
    }
  }

  // Function to find spans by reference ID
  const findSpanById = (id: string): HTMLElement | null => {
    if (!editorRef.current) return null
    return editorRef.current.querySelector(`span[data-ref-id="${id}"]`)
  }

  // Set up the editor with proper text direction
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    // Ensure clean start
    editor.innerHTML = ''
    editor.setAttribute('contenteditable', 'true')
    editor.style.direction = 'ltr'
    editor.style.textAlign = 'left'

    // Add styles for blue text
    const style = document.createElement('style')
    style.textContent = `
      .text-blue-600 {
        color: rgb(37, 99, 235);
        font-weight: 500;
        background-color: rgba(219, 234, 254, 0.3);
        padding: 0 2px;
        border-radius: 2px;
      }
      
      #paste-position-marker {
        display: inline;
        width: 0;
        height: 0;
        opacity: 0;
      }
    `
    document.head.appendChild(style)

    // Focus the editor on load
    setTimeout(() => {
      editor.focus()
    }, 100)

    // Add proper event listeners
    const handleEditorPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return

      const text = e.clipboardData.getData('text/plain')
      if (text.trim()) {
        e.preventDefault()

        // Store the current selection/cursor position
        const selection = window.getSelection()
        const range = selection?.getRangeAt(0)

        // Save the text for the dialog
        setSelectedText(text)

        // Create a temporary marker to save cursor position
        const tempMarker = document.createElement('span')
        tempMarker.id = 'paste-position-marker'
        if (range) {
          range.insertNode(tempMarker)
        } else {
          editor.appendChild(tempMarker)
        }

        // Show dialog after ensuring cursor position is marked
        setIsDialogOpen(true)
      }
    }

    // Monitor changes to detect when a reference span is deleted
    const handleEditorInput = (e: Event) => {
      const length = editor.innerText.length;
      const delta = Math.abs(length - oldTextLength.current);
      oldTextLength.current = length;

      const ev = e as InputEvent;
      if (ev.inputType === "insertText") {
        charAmount.current += delta;
      } else if (ev.inputType.startsWith("delete")) {
        backspaceAmount.current += delta;
      }

      // Get all reference spans in the editor
      const currentRefs = new Set<string>()
      const spans = editor.querySelectorAll('span[data-ref-id]')

      spans.forEach(span => {
        const refId = span.getAttribute('data-ref-id')
        if (refId) currentRefs.add(refId)
      })

      // Check if any reference is missing from the editor
      setReferences(prev => prev.filter(ref => currentRefs.has(ref.id)))
    }

    editor.addEventListener('paste', handleEditorPaste)
    editor.addEventListener('input', handleEditorInput)

    return () => {
      editor.removeEventListener('paste', handleEditorPaste)
      editor.removeEventListener('input', handleEditorInput)
      document.head.removeChild(style)
    }
  }, [])

  // Add effect to handle dialog close
  useEffect(() => {
    if (!isDialogOpen) {
      // If dialog was closed, clean up marker
      const editor = editorRef.current
      const marker = document.getElementById('paste-position-marker')

      if (!marker || !editor) return

      // Check if this was closed by clicking "Add Reference" or just closed/canceled
      const wasAddedAsReference = references.some(ref => ref.text === selectedText)

      if (marker.parentNode) {
        if (wasAddedAsReference) {
          // Do nothing - the handleAddReference function already handled the marker
          // This prevents duplicate text insertion
        } else {
          // Store references to parent and siblings before removing marker
          const parent = marker.parentNode;
          const prevSibling = marker.previousSibling;

          // If dialog was canceled (not added as reference), just remove the marker
          // without adding text (proper cancel behavior)
          parent.removeChild(marker)

          // Set cursor at the position where the marker was
          const selection = window.getSelection()
          if (selection) {
            const range = document.createRange()

            // Use the stored references to set the cursor position
            if (prevSibling) {
              range.setStartAfter(prevSibling)
            } else if (parent.firstChild) {
              range.setStartBefore(parent.firstChild)
            } else {
              range.selectNodeContents(parent)
            }

            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)

            // Focus editor
            editor.focus()
          }
        }
      }
    }
  }, [isDialogOpen, selectedText, references])

  const handleAddReference = () => {
    if (!citation.trim() || !selectedText.trim()) return

    const newReference: Reference = {
      id: Date.now().toString(),
      text: selectedText,
      citation: citation
    }

    setReferences([...references, newReference])

    // Insert the reference at cursor position
    const editor = editorRef.current
    if (!editor) return

    // Create the span with the reference text
    const span = document.createElement('span')
    span.className = 'text-blue-600 font-medium'
    span.textContent = selectedText
    span.setAttribute('data-ref-id', newReference.id) // Add reference ID as data attribute

    // Create a space node and a separate normal text node for typing
    const spaceNode = document.createTextNode('\u00A0') // Non-breaking space
    const textNode = document.createElement('span')  // Empty span for normal text
    textNode.setAttribute('data-normal', 'true')     // Mark as normal text container

    // Find marker if it exists
    const marker = document.getElementById('paste-position-marker')
    if (marker && marker.parentNode) {
      // Insert span, space, and text container
      marker.parentNode.insertBefore(span, marker)
      marker.parentNode.insertBefore(spaceNode, marker)
      marker.parentNode.insertBefore(textNode, marker)
      marker.parentNode.removeChild(marker)

      // Set cursor position in the normal text container
      const selection = window.getSelection()
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(range)
    } else {
      // Fallback - use current selection or append
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)

        // Insert span, space, and text container
        range.insertNode(span)
        range.setStartAfter(span)
        range.insertNode(spaceNode)
        range.setStartAfter(spaceNode)
        range.insertNode(textNode)

        // Move cursor into the normal text container
        range.setStart(textNode, 0)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        // If no selection, append to the end
        editor.appendChild(span)
        editor.appendChild(spaceNode)
        editor.appendChild(textNode)

        // Set cursor in text container
        const selection = window.getSelection()
        const range = document.createRange()
        range.setStart(textNode, 0)
        range.collapse(true)
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    }

    // Force focus back to editor
    editor.focus()

    setIsDialogOpen(false)
    setCitation('')
  }

  useEffect(() => {
    const timer = setInterval(() => {
      charSeries.current.push(charAmount.current);
      backspaceSeries.current.push(backspaceAmount.current);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  const handleRemoveReference = (id: string) => {
    // Remove the reference from the list
    setReferences(references.filter(ref => ref.id !== id))

    // Find and remove the corresponding span from the editor
    const spanToRemove = findSpanById(id)
    if (spanToRemove && editorRef.current) {
      spanToRemove.remove()

      // Refocus the editor
      editorRef.current.focus()
    }
  }

  // Handle cancel button explicitly
  const handleCancelDialog = () => {
    setIsDialogOpen(false)
    setCitation('')
  }

  // Generate questions using API
  const handleGenerateQuestions = async () => {
    const editor = editorRef.current
    if (!editor) return
    
    // Get the text content from the editor
    const text = editor.textContent || editor.innerText
    
    // Ensure there's enough text to generate questions
    if (!text || text.trim().length < 30) {
      alert("Please enter more text before generating questions.")
      return
    }
    
    try {
      setIsGeneratingQuestions(true)
      setQuestions([]) // Clear previous questions
      setIsQuestionsDialogOpen(true) // Open the dialog to show loading state
      
      // Call API
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        const errorMessage = data.details ? `Error: ${data.error} - ${data.details}` : `Error: ${data.error || 'Failed to generate questions'}`
        console.error(errorMessage)
        throw new Error(errorMessage)
      }
      
      // Check if questions array exists in the response
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('Invalid response format: missing questions array')
      }
      
      // Format questions 
      const formattedQuestions = data.questions.map((q: string, index: number) => ({
        id: `q-${Date.now()}-${index}`,
        text: q
      }))
      
      setQuestions(formattedQuestions)
    } catch (error) {
      console.error('Error generating questions:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate questions. Please try again later.')
    } finally {
      setIsGeneratingQuestions(false)
    }
  }

  // Handle export to CSV
  const handleExportToCsv = () => {
    // Export character series and backspace series as CSV file
    // Generate CSV content with character series in first row and backspace series in second row
    const charSeriesString = charSeries.current.join(',');
    const backspaceSeriesString = backspaceSeries.current.join(',');
    const csvContent = `${charSeriesString}\n${backspaceSeriesString}`;

    // Create a Blob from the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create a download link and trigger the download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `detext-metrics-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <div className="shadow-sm border rounded-lg">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold tracking-tight">Detext Editor</h1>
          <p className="text-muted-foreground text-sm">
            Paste text (Ctrl+V) to create references. Citations will appear in the sidebar.
          </p>
        </div>
        <div className="p-6">
          <div className="flex flex-row gap-6">
            <div className="flex-1 flex flex-col">
              <div className="border rounded-lg">
                {/* Toolbar with document actions */}
                <div className="py-2 px-4 bg-muted/50 border-b flex items-center justify-between">
                  <div className="text-sm font-medium">Document</div>
                  <div className="flex gap-2">
                    {/* Generate Questions button */}
                    <button
                      className="h-7 px-2 inline-flex items-center justify-center rounded-md text-sm font-medium text-muted-foreground hover:bg-muted"
                      onClick={handleGenerateQuestions}
                      title="Generate questions from content"
                    >
                      <BrainCircuit className="h-4 w-4 mr-1" />
                      <span>Generate Questions</span>
                    </button>
                    {/* Export to CSV button */}
                    <button
                      className="h-7 px-2 inline-flex items-center justify-center rounded-md text-sm font-medium text-muted-foreground hover:bg-muted"
                      onClick={handleExportToCsv}
                      title="Export metrics to CSV"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      <span>Export</span>
                    </button>
                    <button
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-sm font-medium text-muted-foreground hover:bg-muted"
                      onClick={handleClearDocument}
                      title="Clear document"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="sr-only">Clear document</span>
                    </button>
                  </div>
                </div>
                <div
                  ref={editorRef}
                  className="p-4 min-h-[400px] max-h-[600px] overflow-y-auto focus:outline-none text-black text-base leading-relaxed"
                  style={{
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    caretColor: 'black'
                  }}
                />
              </div>
            </div>

            <div className="w-80">
              <div className="border rounded-lg">
                <div className="py-2 px-4 bg-muted/50 border-b flex items-center justify-between">
                  <div className="text-sm font-medium flex items-center gap-1">
                    <Book className="h-4 w-4" />
                    References
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {references.length} {references.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <div className="p-0">
                  <ScrollArea className="h-[500px]">
                    {references.length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">No references yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Paste text to create references
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 p-4">
                        {references.map((ref) => (
                          <div key={ref.id} className="p-3 bg-card shadow-sm border rounded-md">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1">
                                <p className="text-sm text-blue-600 font-medium mb-1 line-clamp-1">{ref.text}</p>
                                <div className="flex items-center text-xs text-muted-foreground gap-1">
                                  <FileText className="h-3 w-3" />
                                  <span className="truncate">{ref.citation}</span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveReference(ref.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Reference</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Selected Text</h3>
              <div className="bg-muted/40 p-3 rounded-md border text-sm max-h-[150px] overflow-y-auto">
                {selectedText}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="citation" className="text-sm font-medium text-muted-foreground">
                Citation or Reference
              </label>
              <Input
                id="citation"
                placeholder="e.g., (Smith, 2023) or URL source"
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={handleCancelDialog}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleAddReference}>
              Add Reference
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Questions Dialog */}
      <Dialog open={isQuestionsDialogOpen} onOpenChange={setIsQuestionsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generated Questions</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {isGeneratingQuestions ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Generating questions...</p>
              </div>
            ) : questions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No questions generated yet.
              </p>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="p-3 border rounded-md">
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-sm text-primary min-w-[24px]">{index + 1}.</span>
                      <p className="text-sm">{question.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuestionsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}