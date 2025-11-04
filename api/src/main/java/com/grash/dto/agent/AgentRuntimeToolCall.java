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
public class AgentRuntimeToolCall {
    private String toolName;
    private Map<String, Object> arguments;
    private Integer resultCount;
    private String status;
    private String error;
}
