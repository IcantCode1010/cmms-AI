package com.grash.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.dto.agent.AgentDraftActionResponse;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateRequest;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateResponse;
import com.grash.exception.CustomException;
import com.grash.model.AgentDraftAction;
import com.grash.model.Company;
import com.grash.model.OwnUser;
import com.grash.model.WorkOrder;
import com.grash.model.enums.Priority;
import com.grash.model.enums.Status;
import com.grash.repository.AgentDraftActionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentDraftServiceTest {

    @Mock
    private AgentDraftActionRepository draftActionRepository;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private AgentToolService agentToolService;

    private ObjectMapper objectMapper;
    private AgentDraftService agentDraftService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        agentDraftService = new AgentDraftService(draftActionRepository, workOrderService, agentToolService, objectMapper);
    }

    @Test
    void confirmDraftCompletesWorkOrder() {
        OwnUser user = buildUser(9L, 4L);
        String payload = "{\"summary\":\"Complete work order\",\"data\":{\"workOrderId\":99}}";
        AgentDraftAction draftAction = buildDraftAction(user.getId(), user.getCompany().getId(), "complete_work_order", payload);
        WorkOrder workOrder = buildWorkOrder(99L, user.getCompany());

        when(draftActionRepository.findByIdAndUserId(1L, user.getId())).thenReturn(Optional.of(draftAction));
        when(workOrderService.findByIdAndCompany(99L, user.getCompany().getId())).thenReturn(Optional.of(workOrder));
        when(draftActionRepository.save(draftAction)).thenReturn(draftAction);
        when(agentToolService.updateWorkOrderStatus(any(), any(AgentWorkOrderStatusUpdateRequest.class)))
                .thenReturn(AgentWorkOrderStatusUpdateResponse.builder().success(true).build());

        AgentDraftActionResponse response = agentDraftService.confirmDraft(1L, user);

        assertThat(response.getStatus()).isEqualTo("applied");
        assertThat(draftAction.getPayload()).contains("appliedAt");

        verify(draftActionRepository, times(1)).save(draftAction);
        ArgumentCaptor<AgentWorkOrderStatusUpdateRequest> requestCaptor =
                ArgumentCaptor.forClass(AgentWorkOrderStatusUpdateRequest.class);
        verify(agentToolService, times(2)).updateWorkOrderStatus(any(), requestCaptor.capture());
        assertThat(requestCaptor.getAllValues()).hasSize(2);
        assertThat(requestCaptor.getAllValues().get(0).getWorkOrderId()).isEqualTo("99");
        assertThat(requestCaptor.getAllValues().get(0).getNewStatus()).isEqualTo(Status.IN_PROGRESS.name());
        assertThat(requestCaptor.getAllValues().get(1).getWorkOrderId()).isEqualTo("99");
        assertThat(requestCaptor.getAllValues().get(1).getNewStatus()).isEqualTo(Status.COMPLETE.name());
    }

    @Test
    void confirmDraftResolvesWorkOrderByCustomId() {
        OwnUser user = buildUser(12L, 6L);
        String payload = "{\"summary\":\"Complete work order\",\"data\":{\"workOrderId\":\"WO000123\"}}";
        AgentDraftAction draftAction = buildDraftAction(user.getId(), user.getCompany().getId(), "complete_work_order", payload);
        WorkOrder workOrder = buildWorkOrder(321L, user.getCompany());
        workOrder.setCustomId("WO000123");

        when(draftActionRepository.findByIdAndUserId(2L, user.getId())).thenReturn(Optional.of(draftAction));
        when(workOrderService.findByCustomIdIgnoreCaseAndCompany("WO000123", user.getCompany().getId()))
                .thenReturn(Optional.of(workOrder));
        when(draftActionRepository.save(draftAction)).thenReturn(draftAction);
        when(agentToolService.updateWorkOrderStatus(any(), any(AgentWorkOrderStatusUpdateRequest.class)))
                .thenReturn(AgentWorkOrderStatusUpdateResponse.builder().success(true).build());

        AgentDraftActionResponse response = agentDraftService.confirmDraft(2L, user);

        assertThat(response.getStatus()).isEqualTo("applied");
        verify(workOrderService).findByCustomIdIgnoreCaseAndCompany("WO000123", user.getCompany().getId());
        ArgumentCaptor<AgentWorkOrderStatusUpdateRequest> requestCaptor =
                ArgumentCaptor.forClass(AgentWorkOrderStatusUpdateRequest.class);
        verify(agentToolService, times(2)).updateWorkOrderStatus(any(), requestCaptor.capture());
        assertThat(requestCaptor.getAllValues()).hasSize(2);
        assertThat(requestCaptor.getAllValues().get(0).getWorkOrderId()).isEqualTo("WO000123");
        assertThat(requestCaptor.getAllValues().get(0).getNewStatus()).isEqualTo(Status.IN_PROGRESS.name());
        assertThat(requestCaptor.getAllValues().get(1).getWorkOrderId()).isEqualTo("WO000123");
        assertThat(requestCaptor.getAllValues().get(1).getNewStatus()).isEqualTo(Status.COMPLETE.name());
    }

    @Test
    void declineDraftMarksDeclined() {
        OwnUser user = buildUser(21L, 8L);
        AgentDraftAction draftAction = buildDraftAction(user.getId(), user.getCompany().getId(), "complete_work_order", "{\"summary\":\"Decline\",\"data\":{\"workOrderId\":1}}");

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

    @Test
    void confirmDraftWithoutNestedWorkOrderIdFails() {
        OwnUser user = buildUser(44L, 22L);
        AgentDraftAction draftAction = buildDraftAction(user.getId(), user.getCompany().getId(), "complete_work_order",
                "{\"summary\":\"Complete\",\"data\":{}}");

        when(draftActionRepository.findByIdAndUserId(13L, user.getId())).thenReturn(Optional.of(draftAction));
        when(draftActionRepository.save(draftAction)).thenReturn(draftAction);

        assertThatThrownBy(() -> agentDraftService.confirmDraft(13L, user))
                .isInstanceOf(CustomException.class)
                .hasMessage("Draft payload missing workOrderId");
        assertThat(draftAction.getStatus()).isEqualTo("failed");
        verify(draftActionRepository).save(draftAction);
    }

    @Test
    void confirmDraftSkipsCompletedWorkOrder() {
        OwnUser user = buildUser(55L, 24L);
        String payload = "{\"summary\":\"Complete work order\",\"data\":{\"workOrderId\":321}}";
        AgentDraftAction draftAction = buildDraftAction(user.getId(), user.getCompany().getId(), "complete_work_order", payload);
        WorkOrder workOrder = buildWorkOrder(321L, user.getCompany());
        workOrder.setStatus(Status.COMPLETE);

        when(draftActionRepository.findByIdAndUserId(99L, user.getId())).thenReturn(Optional.of(draftAction));
        when(workOrderService.findByIdAndCompany(321L, user.getCompany().getId())).thenReturn(Optional.of(workOrder));
        when(draftActionRepository.save(draftAction)).thenReturn(draftAction);

        AgentDraftActionResponse response = agentDraftService.confirmDraft(99L, user);

        assertThat(response.getStatus()).isEqualTo("applied");
        assertThat(draftAction.getPayload()).contains("Work order already complete.");
        verify(agentToolService, never()).updateWorkOrderStatus(any(), any());
    }

    @Test
    void confirmCreateWorkOrderDraftCreatesRecord() {
        OwnUser user = buildUser(77L, 35L);
        String payload = "{\"summary\":\"Create work order\",\"data\":{\"title\":\"HVAC filter replacement\",\"description\":\"Replace filters on rooftop unit\",\"priority\":\"High\",\"locationId\":42}}";
        AgentDraftAction draftAction = buildDraftAction(user.getId(), user.getCompany().getId(), "create_work_order", payload);
        WorkOrder created = buildWorkOrder(501L, user.getCompany());
        created.setCustomId("WO000501");

        when(draftActionRepository.findByIdAndUserId(3L, user.getId())).thenReturn(Optional.of(draftAction));
        when(draftActionRepository.save(draftAction)).thenReturn(draftAction);
        when(workOrderService.create(any(WorkOrder.class), eq(user.getCompany()))).thenReturn(created);

        AgentDraftActionResponse response = agentDraftService.confirmDraft(3L, user);

        assertThat(response.getStatus()).isEqualTo("applied");
        assertThat(draftAction.getStatus()).isEqualTo("applied");
        assertThat(draftAction.getPayload()).contains("Work order created.");
        assertThat(draftAction.getPayload()).contains("WO000501");

        ArgumentCaptor<WorkOrder> workOrderCaptor = ArgumentCaptor.forClass(WorkOrder.class);
        verify(workOrderService).create(workOrderCaptor.capture(), eq(user.getCompany()));
        WorkOrder captured = workOrderCaptor.getValue();
        assertThat(captured.getTitle()).isEqualTo("HVAC filter replacement");
        assertThat(captured.getDescription()).isEqualTo("Replace filters on rooftop unit");
        assertThat(captured.getPriority()).isEqualTo(Priority.HIGH);
    }

    @Test
    void confirmCreateWorkOrderDraftWithoutTitleFails() {
        OwnUser user = buildUser(88L, 36L);
        String payload = "{\"summary\":\"Create work order\",\"data\":{\"description\":\"Missing title\"}}";
        AgentDraftAction draftAction = buildDraftAction(user.getId(), user.getCompany().getId(), "create_work_order", payload);

        when(draftActionRepository.findByIdAndUserId(4L, user.getId())).thenReturn(Optional.of(draftAction));
        when(draftActionRepository.save(draftAction)).thenReturn(draftAction);

        assertThatThrownBy(() -> agentDraftService.confirmDraft(4L, user))
                .isInstanceOf(CustomException.class)
                .hasMessageContaining("Draft payload missing title");

        assertThat(draftAction.getStatus()).isEqualTo("failed");
        verify(workOrderService, never()).create(any(WorkOrder.class), any());
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




