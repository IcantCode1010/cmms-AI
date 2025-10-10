package com.grash.configuration;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "agent")
public class AgentProperties {
    /**
     * Feature flag that controls exposure of ChatKit-powered experiences on the API.
     */
    private boolean chatkitEnabled = false;

    /**
     * Optional identifier for the default ChatKit agent to route conversations to.
     */
    private String chatkitAgentId;

    /**
     * Base URL for the OpenAI Agents runtime (Node sidecar or direct SaaS endpoint).
     */
    private String runtimeUrl;

    /**
     * Bearer token or API key used when authenticating outbound calls to the Agents runtime.
     */
    private String runtimeToken;

    /**
     * Client-side timeout (in milliseconds) for agent interactions to complete.
     */
    private Integer timeoutMs = 30000;

    /**
     * Maximum number of rows returned from any single tool invocation.
     */
    private Integer maxToolResults = 50;
}
