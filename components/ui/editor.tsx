'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RefreshCw, Book, FileText, Trash2 } from 'lucide-react'

interface Reference {
  id: string
  text: string
  citation: string
}

export function Editor() {
  const [references, setReferences] = useState<Reference[]>([])
  const [selectedText, setSelectedText] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [citation, setCitation] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)

  // Clear document function
  const handleClearDocument = () => {
    if (editorRef.current) {
      editorRef.current.innerHTML = ''
      editorRef.current.focus()
    }
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
    
    editor.addEventListener('paste', handleEditorPaste)
    
    return () => {
      editor.removeEventListener('paste', handleEditorPaste)
      document.head.removeChild(style)
    }
  }, [])

  // Add effect to handle dialog close
  useEffect(() => {
    if (!isDialogOpen) {
      // If dialog was closed without adding reference, clean up marker
      const editor = editorRef.current
      const marker = document.getElementById('paste-position-marker')
      
      if (!marker || !editor) return
      
      // Replace marker with the plain text if we didn't add a reference
      if (marker.parentNode) {
        const textNode = document.createTextNode(selectedText)
        const spaceNode = document.createTextNode(' ')
        
        // Insert text and space, then remove marker
        marker.parentNode.insertBefore(textNode, marker)
        marker.parentNode.insertBefore(spaceNode, marker)
        marker.parentNode.removeChild(marker)
        
        // Set cursor after the space
        const selection = window.getSelection()
        if (selection) {
          const range = document.createRange()
          range.setStartAfter(spaceNode)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
          
          // Focus editor
          editor.focus()
        }
      }
    }
  }, [isDialogOpen, selectedText])

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
    
    // Create a space after the span to ensure cursor is outside the colored span
    const spaceNode = document.createTextNode(' ')
    
    // Find marker if it exists
    const marker = document.getElementById('paste-position-marker')
    if (marker && marker.parentNode) {
      // Insert span and space
      marker.parentNode.insertBefore(span, marker)
      marker.parentNode.insertBefore(spaceNode, marker)
      marker.parentNode.removeChild(marker)
      
      // Set cursor position after the space, not in the colored span
      const selection = window.getSelection()
      const range = document.createRange()
      range.setStartAfter(spaceNode)
      range.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(range)
    } else {
      // Fallback - use current selection or append
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        
        // Insert span and space
        range.insertNode(span)
        range.setStartAfter(span)
        range.insertNode(spaceNode)
        
        // Move cursor after the space
        range.setStartAfter(spaceNode)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        // If no selection, append to the end
        editor.appendChild(span)
        editor.appendChild(spaceNode)
        
        // Set cursor after space
        const selection = window.getSelection()
        const range = document.createRange()
        range.setStartAfter(spaceNode)
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

  const handleRemoveReference = (id: string) => {
    setReferences(references.filter(ref => ref.id !== id))
  }

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
                <div className="py-2 px-4 bg-muted/50 border-b flex items-center justify-between">
                  <div className="text-sm font-medium">Document</div>
                  <button 
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md text-sm font-medium text-muted-foreground hover:bg-muted"
                    onClick={handleClearDocument}
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="sr-only">Clear document</span>
                  </button>
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleAddReference}>
              Add Reference
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}