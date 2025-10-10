package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AgentRuntimeResponse {
    private String status;
    private String message;
    private String agentId;
    private String sessionId;
    @Builder.Default
    private List<AgentChatMessage> messages = Collections.emptyList();
    @Builder.Default
    private List<AgentRuntimeToolCall> toolCalls = Collections.emptyList();
    @Builder.Default
    private List<AgentRuntimeDraft> drafts = Collections.emptyList();
    @Builder.Default
    private Map<String, Object> metadata = Collections.emptyMap();

    public boolean isSuccessful() {
        return "success".equalsIgnoreCase(status);
    }
}
