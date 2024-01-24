import { Injectable } from '@nestjs/common';
import {assignmentes} from '../../../drizzle/schema';
import { db} from '../../db/index';
import { eq } from 'drizzle-orm';


@Injectable()
export class AssignmentService {

    async createAssignment(assignmentData) {
        try {
            const newData = await db.insert(assignmentes).values(assignmentData).returning();
            return { 'status': 'success', 'message': 'assignment created successfully', 'code': 200, assignment: newData[0] };
        } catch (e) {
            return { 'status': 'error', 'message': e.message, 'code': 500 };
        }
    }

    async getAssignmentById(id: number) {
        try {
            let data = await db.select().from(assignmentes).where(eq(assignmentes.id, id));
            if (data.length === 0) {
                return {status: 'error', message: 'assignment not found', code: 404};
            }
            return {status: 'success', message: 'assignment fetched successfully', code: 200, assignment: data[0]};
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async getAllassignmentes(){
        try {
            return await db.select().from(assignmentes);
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async updateAssignment(id: number, assignment: object) {
        try {
            assignment['updatedAt'] = new Date();
            let updateData = await db.update(assignmentes).set(assignment).where(eq(assignmentes.id, id)).returning()
            if (updateData.length === 0) {
                return {status: 'error', message: 'assignment not found', code: 404};
            }
            return {status: 'success', message: 'assignment updated successfully', code: 200, assignment: updateData[0]};
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    async deleteAssignment(id: number) {
        try {
            let data = await db.delete(assignmentes).where(eq(assignmentes.id, id)).returning();
            if (data.length === 0) {
                return {status: 'error', message: 'assignment not found', code: 404};
            }
            return {status: 'success', message: 'assignment deleted successfully', code: 200};
        } catch (e) {
            return {'status': 'error', 'message': e.message,'code': 500};
        }
    }

    
}