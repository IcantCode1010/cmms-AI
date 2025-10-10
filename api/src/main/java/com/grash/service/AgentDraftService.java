package com.grash.service;

import com.grash.dto.agent.AgentDraftActionResponse;
import com.grash.exception.CustomException;
import com.grash.model.AgentDraftAction;
import com.grash.repository.AgentDraftActionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AgentDraftService {

    private final AgentDraftActionRepository draftActionRepository;

    public List<AgentDraftActionResponse> getPendingDrafts(Long userId) {
        return draftActionRepository.findByUserIdAndStatus(userId, "pending")
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public AgentDraftActionResponse confirmDraft(Long draftId, Long userId) {
        AgentDraftAction draftAction = draftActionRepository.findByIdAndUserId(draftId, userId)
                .orElseThrow(() -> new CustomException("Draft action not found", HttpStatus.NOT_FOUND));
        draftAction.setStatus("confirmed");
        draftAction.setUpdatedAt(Instant.now());
        return toResponse(draftActionRepository.save(draftAction));
    }

    public AgentDraftActionResponse declineDraft(Long draftId, Long userId) {
        AgentDraftAction draftAction = draftActionRepository.findByIdAndUserId(draftId, userId)
                .orElseThrow(() -> new CustomException("Draft action not found", HttpStatus.NOT_FOUND));
        draftAction.setStatus("declined");
        draftAction.setUpdatedAt(Instant.now());
        return toResponse(draftActionRepository.save(draftAction));
    }

    private AgentDraftActionResponse toResponse(AgentDraftAction action) {
        return AgentDraftActionResponse.builder()
                .id(action.getId())
                .agentSessionId(action.getAgentSessionId())
                .operationType(action.getOperationType())
                .payload(action.getPayload())
                .status(action.getStatus())
                .createdAt(action.getCreatedAt())
                .updatedAt(action.getUpdatedAt())
                .build();
    }
}
