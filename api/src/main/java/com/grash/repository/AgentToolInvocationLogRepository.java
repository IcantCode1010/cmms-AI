package com.grash.repository;

import com.grash.model.AgentToolInvocationLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentToolInvocationLogRepository extends JpaRepository<AgentToolInvocationLog, Long> {
}
