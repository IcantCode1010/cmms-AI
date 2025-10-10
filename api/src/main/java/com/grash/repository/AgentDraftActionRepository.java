package com.grash.repository;

import com.grash.model.AgentDraftAction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AgentDraftActionRepository extends JpaRepository<AgentDraftAction, Long> {
    List<AgentDraftAction> findByUserIdAndStatus(Long userId, String status);

    Optional<AgentDraftAction> findByIdAndUserId(Long id, Long userId);
}
