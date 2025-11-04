"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, Loader2, Sparkles, FileText, ExternalLink, RefreshCw } from "lucide-react"
import { useSIO } from "@/lib/sio-context"
import { cn } from "@/lib/utils"

interface IntentChatProps {
  onWorkOrderClick?: (workOrderId: string) => void
}

export function IntentChat({ onWorkOrderClick }: IntentChatProps) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { sio, addMessage, addProposal, updateContext, getWorkOrdersByAsset, workOrders } = useSIO()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [sio.messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setIsLoading(true)

    addMessage({
      role: "user",
      content: userMessage,
    })

    try {
      // TODO: Wire to backend endpoint /api/intent
      await new Promise((resolve) => setTimeout(resolve, 800))

      const tailMatch = userMessage.match(/\b(N\d{1,5}[A-Z]{1,3})\b/i)
      const extractedTail = tailMatch ? tailMatch[1].toUpperCase() : null

      if (extractedTail) {
        updateContext({ tail: extractedTail })
      }

      const isTroubleshooting = /pack|pressure|fire|warning|transducer|fault|symptom|issue|problem/i.test(userMessage)
      const isViewRequest = /show|view|list|get|find|history|status/i.test(userMessage)

      let mockCitations
      let responseContent
      let proposalData

      if (isViewRequest && extractedTail) {
        const assetWorkOrders = getWorkOrdersByAsset(extractedTail)

        mockCitations = [
          {
            id: crypto.randomUUID(),
            source: "Work Order Database",
            text: `Found ${assetWorkOrders.length} work orders for ${extractedTail}`,
            url: `/aircraft/${extractedTail}/work-orders`,
          },
        ]

        if (assetWorkOrders.length > 0) {
          const woLinks = assetWorkOrders.map((wo) => `[${wo.id}](wo://${wo.id})`).join(", ")
          responseContent = `I found ${assetWorkOrders.length} work orders for tail ${extractedTail}:\n\n${woLinks}\n\nThe most recent include: ${assetWorkOrders[0].title.split(" - ")[1]} (${assetWorkOrders[0].status}). Would you like details on any specific work order?`
        } else {
          responseContent = `I found no work orders for tail ${extractedTail}. Would you like to create a new work order?`
        }
      } else if (isViewRequest && /all|open/i.test(userMessage)) {
        const openWorkOrders = workOrders.filter((wo) => wo.status !== "completed" && wo.status !== "cancelled")
        const criticalCount = openWorkOrders.filter((wo) => wo.priority === "critical").length
        const highCount = openWorkOrders.filter((wo) => wo.priority === "high").length

        mockCitations = [
          {
            id: crypto.randomUUID(),
            source: "Work Order Database",
            text: `Found ${openWorkOrders.length} open work orders`,
            url: "/work-orders",
          },
        ]

        const woLinks = openWorkOrders
          .slice(0, 5)
          .map((wo) => `[${wo.id}](wo://${wo.id})`)
          .join(", ")

        responseContent = `I found ${openWorkOrders.length} open work orders across the fleet:\n\n${woLinks}${openWorkOrders.length > 5 ? ", ..." : ""}\n\nPriority breakdown: ${criticalCount} critical, ${highCount} high priority. Would you like me to filter by aircraft, priority, or system?`
      } else if (isTroubleshooting && extractedTail) {
        mockCitations = [
          {
            id: crypto.randomUUID(),
            source: "AMM 21-31-00",
            text: "Air Conditioning Pack - Low Pressure Troubleshooting",
            url: "/manuals/amm-21-31-00",
          },
          {
            id: crypto.randomUUID(),
            source: "Fleet History",
            text: `${extractedTail}: 3 similar pack pressure events in last 90 days`,
            url: `/aircraft/${extractedTail}/history`,
          },
          {
            id: crypto.randomUUID(),
            source: "TSM 21-00-00",
            text: "Pack Control Valve replacement recommended after 3+ occurrences",
            url: "/manuals/tsm-21-00-00",
          },
        ]

        responseContent = `I've analyzed the symptom for tail ${extractedTail}. Based on the maintenance records and technical manuals, this appears to be a recurring issue with the left pack control valve. The fleet history shows ${extractedTail} has experienced similar low pressure events 3 times in the past 90 days, which exceeds the threshold for component replacement per TSM 21-00-00.`

        proposalData = {
          title: `${extractedTail} - Left Pack Control Valve Replacement`,
          description: `Replace left air conditioning pack control valve per AMM 21-31-00. Recurring low pressure events indicate valve degradation. Problem Code: 21-31-001`,
          priority: "high" as const,
          estimatedCost: 3200,
          estimatedTime: "4-6 hours",
          citations: mockCitations,
          status: "pending" as const,
        }
      } else {
        mockCitations = [
          {
            id: crypto.randomUUID(),
            source: "Asset Database",
            text: "HVAC Unit #A-203 last serviced 45 days ago",
            url: "/assets/A-203",
          },
          {
            id: crypto.randomUUID(),
            source: "Maintenance Schedule",
            text: "Quarterly HVAC maintenance due within 15 days",
            url: "/schedule/hvac",
          },
        ]

        responseContent = `I understand you're concerned about the HVAC system in Building A. Based on the maintenance records, I've identified that Unit #A-203 is due for its quarterly service. I recommend scheduling preventive maintenance to avoid potential issues during peak season.`

        proposalData = {
          title: "HVAC Unit A-203 Preventive Maintenance",
          description:
            "Quarterly preventive maintenance including filter replacement, coil cleaning, refrigerant check, and system diagnostics.",
          priority: "medium" as const,
          estimatedCost: 450,
          estimatedTime: "2-3 hours",
          citations: mockCitations,
          status: "pending" as const,
        }
      }

      addMessage({
        role: "assistant",
        content: responseContent,
        citations: mockCitations,
      })

      if (proposalData) {
        addProposal(proposalData)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      addMessage({
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\[WO-\d{4}-\d{3}\]$$wo:\/\/WO-\d{4}-\d{3}$$)/g)

    return parts.map((part, index) => {
      const linkMatch = part.match(/\[(WO-\d{4}-\d{3})\]$$wo:\/\/(WO-\d{4}-\d{3})$$/)
      if (linkMatch) {
        const woId = linkMatch[2]
        return (
          <button
            key={index}
            onClick={() => onWorkOrderClick?.(woId)}
            className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            {linkMatch[1]}
            <ExternalLink className="h-3 w-3" />
          </button>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex h-16 items-center justify-between border-b border-border/50 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">AI Maintenance Assistant</h2>
            <p className="text-xs text-muted-foreground">Intent-driven maintenance analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 px-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <span className="text-xs font-medium">Active</span>
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh session</span>
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        <div className="space-y-6 py-6">
          {sio.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 shadow-lg">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-foreground">Welcome to AI Maintenance Assistant</h3>
              <p className="mb-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Describe your maintenance needs in natural language. I'll analyze your intent, provide recommendations
                with citations, and generate actionable proposals.
              </p>
              <p className="mb-8 text-xs text-muted-foreground">Powered by intent-driven AI analysis</p>
              <div className="grid w-full max-w-md gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start text-left bg-transparent"
                  onClick={() => setInput("The HVAC system in Building A is making unusual noises")}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">HVAC Troubleshooting</span>
                    <span className="text-xs text-muted-foreground">Building A unusual noises</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start text-left bg-transparent"
                  onClick={() => setInput("N123UA has left pack low pressure at cruise")}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">Aircraft Diagnostics</span>
                    <span className="text-xs text-muted-foreground">N123UA pack pressure issue</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start text-left bg-transparent"
                  onClick={() => setInput("Show me all open work orders for N456XY")}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">Work Order Query</span>
                    <span className="text-xs text-muted-foreground">View open work orders</span>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {sio.messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
            >
              {message.role === "assistant" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-sm">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] space-y-2 rounded-xl px-4 py-3 shadow-sm",
                  message.role === "user"
                    ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground"
                    : "bg-muted/50 text-foreground border border-border/50",
                )}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{renderMessageContent(message.content)}</p>
                {message.citations && message.citations.length > 0 && (
                  <div className="space-y-2 border-t border-border/50 pt-3 mt-3">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground">
                        {message.citations.length} Citation{message.citations.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    {message.citations.map((citation) => (
                      <div
                        key={citation.id}
                        className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/80 p-2.5 transition-colors hover:bg-background"
                      >
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-semibold text-foreground">{citation.source}</p>
                          <p className="text-xs leading-relaxed text-muted-foreground">{citation.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80 text-xs font-semibold text-accent-foreground shadow-sm">
                  JD
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-sm">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/50 px-4 py-3 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Analyzing your request...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/50 bg-muted/20 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about maintenance, work orders, or equipment..."
            className="min-h-[60px] resize-none border-border/50 bg-background shadow-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-[60px] w-[60px] shadow-sm"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            <span className="sr-only">Send message</span>
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Enter</kbd> to send,{" "}
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  )
}
