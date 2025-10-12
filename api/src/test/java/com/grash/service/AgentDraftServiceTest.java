package com.grash.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.dto.agent.AgentDraftActionResponse;
import com.grash.exception.CustomException;
import com.grash.model.AgentDraftAction;
import com.grash.model.Company;
import com.grash.model.OwnUser;
import com.grash.model.WorkOrder;
import com.grash.model.enums.Status;
import com.grash.repository.AgentDraftActionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentDraftServiceTest {

    @Mock
    private AgentDraftActionRepository draftActionRepository;
    @Mock
    private WorkOrderService workOrderService;

    private ObjectMapper objectMapper;
    private AgentDraftService agentDraftService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        agentDraftService = new AgentDraftService(draftActionRepository, workOrderService, objectMapper);
    }

    @Test
    void confirmDraftCompletesWorkOrder() {
        OwnUser user = buildUser(9L, 4L);
        AgentDraftAction draftAction = buildDraftAction(user.getId(), user.getCompany().getId(), "complete_work_order", "{\"workOrderId\":99}");
        WorkOrder workOrder = buildWorkOrder(99L, user.getCompany());

        when(draftActionRepository.findByIdAndUserId(1L, user.getId())).thenReturn(Optional.of(draftAction));
        when(workOrderService.findByIdAndCompany(99L, user.getCompany().getId())).thenReturn(Optional.of(workOrder));
        when(workOrderService.saveAndFlush(any(WorkOrder.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(draftActionRepository.save(draftAction)).thenReturn(draftAction);

        AgentDraftActionResponse response = agentDraftService.confirmDraft(1L, user);

        assertThat(response.getStatus()).isEqualTo("applied");
        assertThat(workOrder.getStatus()).isEqualTo(Status.COMPLETE);
        assertThat(workOrder.getCompletedBy()).isEqualTo(user);
        assertThat(draftAction.getPayload()).contains("appliedAt");

        verify(workOrderService).saveAndFlush(workOrder);
        verify(draftActionRepository, times(1)).save(draftAction);
    }

    @Test
    void declineDraftMarksDeclined() {
        OwnUser user = buildUser(21L, 8L);
        AgentDraftAction draftAction = buildDraftAction(user.getId(), user.getCompany().getId(), "complete_work_order", "{\"workOrderId\":1}");

        when(draftActionRepository.findByIdAndUserId(55L, user.getId())).thenReturn(Optional.of(draftAction));
        when(draftActionRepository.save(draftAction)).thenReturn(draftAction);

        AgentDraftActionResponse response = agentDraftService.declineDraft(55L, user);
        assertThat(response.getStatus()).isEqualTo("declined");
        verify(draftActionRepository).save(draftAction);
    }

    @Test
    void unsupportedOperationFailsGracefully() {
        OwnUser user = buildUser(31L, 19L);
        AgentDraftAction draftAction = buildDraftAction(user.getId(), user.getCompany().getId(), "archive_asset", "{}");

        when(draftActionRepository.findByIdAndUserId(7L, user.getId())).thenReturn(Optional.of(draftAction));
        when(draftActionRepository.save(draftAction)).thenReturn(draftAction);

        assertThatThrownBy(() -> agentDraftService.confirmDraft(7L, user))
                .isInstanceOf(CustomException.class)
                .hasMessageContaining("Unsupported draft operation");
        assertThat(draftAction.getStatus()).isEqualTo("failed");
        verify(draftActionRepository, times(1)).save(draftAction);
    }

    private AgentDraftAction buildDraftAction(Long userId, Long companyId, String operation, String payload) {
        AgentDraftAction draftAction = new AgentDraftAction();
        draftAction.setId(1L);
        draftAction.setUserId(userId);
        draftAction.setCompanyId(companyId);
        draftAction.setAgentSessionId("session-1");
        draftAction.setOperationType(operation);
        draftAction.setPayload(payload);
        draftAction.setStatus("pending");
        draftAction.setCreatedAt(Instant.now());
        return draftAction;
    }

    private WorkOrder buildWorkOrder(Long id, Company company) {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(id);
        workOrder.setCompany(company);
        workOrder.setStatus(Status.OPEN);
        return workOrder;
    }

    private OwnUser buildUser(Long userId, Long companyId) {
        Company company = new Company();
        company.setId(companyId);

        OwnUser user = new OwnUser();
        user.setId(userId);
        user.setCompany(company);
        user.setFirstName("Review");
        user.setLastName("User");
        user.setEmail("review@example.com");
        return user;
    }
}

