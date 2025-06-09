import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private assessmentClients: Map<number, Subject<any>> = new Map();

  // Connect a client to an assessment's SSE stream
  connectToAssessment(assessmentId: number): Observable<any> {
    if (!this.assessmentClients.has(assessmentId)) {
      this.assessmentClients.set(assessmentId, new Subject<any>());
    }
    return this.assessmentClients.get(assessmentId).asObservable();
  }

  // Notify all clients connected to an assessment about state changes
  notifyAssessmentStateChange(assessmentId: number, newState: number) {
    const clients = this.assessmentClients.get(assessmentId);
    if (clients) {
      const stateMessages = {
        0: 'Assessment is in draft mode',
        1: 'Assessment is now published',
        2: 'Assessment is now active',
        3: 'Assessment is now closed'
      };
      
      clients.next({
        type: 'state_change',
        message: stateMessages[newState],
        state: newState,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Notify all clients connected to an assessment about deletion
  notifyAssessmentDeletion(assessmentId: number) {
    const clients = this.assessmentClients.get(assessmentId);
    if (clients) {
      clients.next({
        type: 'assessment_deleted',
        message: 'This assessment has been deleted by the administrator.',
        timestamp: new Date().toISOString()
      });
      // Clean up the subject after sending the notification
      clients.complete();
      this.assessmentClients.delete(assessmentId);
    }
  }

  // Remove a client's connection
  disconnectFromAssessment(assessmentId: number) {
    const clients = this.assessmentClients.get(assessmentId);
    if (clients) {
      clients.complete();
      this.assessmentClients.delete(assessmentId);
    }
  }
} 