package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;



@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentChatResponse {

    /**
     * High-level response status (disabled, accepted, failed, etc).
     */
    private String status;

    /**
     * Human readable message explaining the current status.
     */
    private String message;

    /**
     * Agent identifier used for the request (either provided or defaulted).
     */
    private String agentId;

    /**
     * Correlation identifier for tracing calls across services.
     */
    private String correlationId;

    /**
     * Session identifier returned by the runtime.
     */
    private String sessionId;

    /**
     * Chat transcript supplied by the runtime (assistant/system messages).
     */
    private List<AgentChatMessage> messages;

    /**
     * Draft actions that require user confirmation.
     */
    private List<AgentDraftActionResponse> drafts;

    /**
     * Tool invocation telemetry returned by the runtime.
     */
    private List<AgentRuntimeToolCall> toolCalls;

    public static AgentChatResponse disabled(String agentId, String correlationId) {
        return AgentChatResponse.builder()
                .status("disabled")
                .message("ChatKit agent integration is not enabled for this environment.")
                .agentId(agentId)
                .correlationId(correlationId)
                .build();
    }

    public static AgentChatResponse pending(String agentId, String correlationId) {
        return AgentChatResponse.builder()
                .status("pending")
                .message("Prompt accepted. Awaiting response from OpenAI Agents runtime.")
                .agentId(agentId)
                .correlationId(correlationId)
                .build();
    }

    public static AgentChatResponse notReady(String agentId, String correlationId) {
        return AgentChatResponse.builder()
                .status("not_ready")
                .message("Agent runtime is not configured. Please try again later.")
                .agentId(agentId)
                .correlationId(correlationId)
                .build();
    }

    public static AgentChatResponse error(String agentId, String correlationId, String message) {
        return AgentChatResponse.builder()
                .status("error")
                .message(message)
                .agentId(agentId)
                .correlationId(correlationId)
                .build();
    }

    public static AgentChatResponse fromRuntime(String correlationId,
                                                AgentRuntimeResponse runtimeResponse,
                                                List<AgentDraftActionResponse> drafts) {
        return AgentChatResponse.builder()
                .status(runtimeResponse.getStatus())
                .message(runtimeResponse.getMessage())
                .agentId(runtimeResponse.getAgentId())
                .correlationId(correlationId)
                .sessionId(runtimeResponse.getSessionId())
                .messages(runtimeResponse.getMessages())
                .drafts(drafts)
                .toolCalls(runtimeResponse.getToolCalls())
                .build();
    }
}
