package com.grash.model;

import lombok.Getter;
import lombok.Setter;

import javax.persistence.*;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "agent_draft_action")
public class AgentDraftAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "company_id")
    private Long companyId;

    @Column(name = "agent_session_id", length = 100, nullable = false)
    private String agentSessionId;

    @Column(name = "operation_type", length = 100, nullable = false)
    private String operationType;

    @Column(name = "payload", columnDefinition = "TEXT", nullable = false)
    private String payload;

    @Column(name = "status", length = 50, nullable = false)
    private String status = "pending";
}
