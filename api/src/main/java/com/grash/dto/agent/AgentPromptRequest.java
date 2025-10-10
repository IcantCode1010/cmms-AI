package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.util.HashMap;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AgentPromptRequest {

    @Size(max = 128, message = "Agent identifier length must be at most 128 characters")
    private String agentId;

    @NotBlank(message = "Prompt must not be blank")
    @Size(max = 4000, message = "Prompt must be at most 4000 characters")
    private String prompt;

    private Map<String, Object> metadata = new HashMap<>();
}
