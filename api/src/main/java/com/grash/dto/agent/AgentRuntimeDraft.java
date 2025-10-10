package com.grash.dto.agent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentRuntimeDraft {
    private String agentSessionId;
    private String operationType;
    private Map<String, Object> payload;
    private String summary;
}
