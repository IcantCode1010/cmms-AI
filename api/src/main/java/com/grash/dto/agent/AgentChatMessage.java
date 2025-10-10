package com.grash.dto.agent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentChatMessage {
    /**
     * Role of the message author (assistant, system, tool, user).
     */
    private String role;

    /**
     * Content of the chat message rendered to the user.
     */
    private String content;
}
