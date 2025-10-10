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
public class AgentRuntimeRequest {
    private String agentId;
    private String prompt;
    private Map<String, Object> metadata;
    private Map<String, Object> user;
}
