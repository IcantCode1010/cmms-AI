package com.grash.model;

import lombok.Getter;
import lombok.Setter;

import javax.persistence.*;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "agent_tool_invocation_log")
public class AgentToolInvocationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "company_id")
    private Long companyId;

    @Column(name = "tool_name", length = 100, nullable = false)
    private String toolName;

    @Column(name = "arguments_json", columnDefinition = "TEXT")
    private String argumentsJson;

    @Column(name = "result_count")
    private Integer resultCount;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "correlation_id", length = 100)
    private String correlationId;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
