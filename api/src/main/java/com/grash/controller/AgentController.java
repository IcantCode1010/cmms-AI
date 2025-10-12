package com.grash.controller;

import com.grash.configuration.AgentProperties;
import com.grash.dto.agent.AgentChatResponse;
import com.grash.dto.agent.AgentDraftActionResponse;
import com.grash.dto.agent.AgentPromptRequest;
import com.grash.model.OwnUser;
import com.grash.service.AgentDraftService;
import com.grash.service.AgentService;
import com.grash.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/agent")
@Validated
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final AgentProperties agentProperties;
    private final AgentDraftService agentDraftService;
    private final UserService userService;

    @PostMapping("/chat")
    public ResponseEntity<AgentChatResponse> handlePrompt(
            HttpServletRequest httpServletRequest,
            @Valid @RequestBody AgentPromptRequest request) {

        String correlationId = agentService.generateCorrelationId();
        if (!agentProperties.isChatkitEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                    .body(AgentChatResponse.disabled(resolveAgentId(request), correlationId));
        }

        OwnUser user = userService.whoami(httpServletRequest);
        String authorizationHeader = httpServletRequest.getHeader("Authorization");
        AgentChatResponse response = agentService.handlePrompt(user, request, authorizationHeader);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/drafts")
    public ResponseEntity<List<AgentDraftActionResponse>> getDrafts(HttpServletRequest request) {
        if (!agentProperties.isChatkitEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        OwnUser user = userService.whoami(request);
        return ResponseEntity.ok(agentDraftService.getPendingDrafts(user));
    }

    @PostMapping("/drafts/{draftId}/confirm")
    public ResponseEntity<AgentDraftActionResponse> confirmDraft(
            HttpServletRequest request,
            @PathVariable Long draftId) {
        if (!agentProperties.isChatkitEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        OwnUser user = userService.whoami(request);
        return ResponseEntity.ok(agentDraftService.confirmDraft(draftId, user));
    }

    @DeleteMapping("/drafts/{draftId}")
    public ResponseEntity<AgentDraftActionResponse> declineDraft(
            HttpServletRequest request,
            @PathVariable Long draftId) {
        if (!agentProperties.isChatkitEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        OwnUser user = userService.whoami(request);
        return ResponseEntity.ok(agentDraftService.declineDraft(draftId, user));
    }

    private String resolveAgentId(AgentPromptRequest request) {
        if (request.getAgentId() != null && !request.getAgentId().isEmpty()) {
            return request.getAgentId();
        }
        return agentProperties.getChatkitAgentId();
    }
}

