import { relations } from "drizzle-orm/relations";
import { partnersInMain, cUsersInMain, schoolInMain, studentsSchoolInMain, studentsInMain, schoolStageInMain, campusInMain, campusSchoolInMain, studentsStagesInMain, engArticlesInMain, engLevelwiseInMain, usersInMain, engHistoryInMain, userRolesInMain, exercisesHistoryInMain, c4CaTeamsInMain, partnerSpaceInMain, spaceGroupInMain, c4CaPartnersInMain, facilitatorsInMain, contactsInMain, incomingCallsInMain, courseEnrolmentsInMain, coursesInMain, courseRelationInMain, testVersionsInMain, questionSetsInMain, enrolmentKeysInMain, exercisesInMain, coursesV2InMain, assessmentInMain, exercisesV2InMain, interviewOwnersInMain, stageTransitionsInMain, studentCampusInMain, chanakyaRolesInMain, chanakyaUserRolesInMain, chanakyaPrivilegeInMain, chanakyaAccessInMain, chanakyaPartnerGroupInMain, chanakyaPartnerRelationshipInMain, categoryInMain, classesInMain, recurringClassesInMain, volunteerInMain, classRegistrationsInMain, classesMailInMain, courseCategoriesInMain, courseCompletionInMain, courseCompletionV2InMain, courseEditorStatusInMain, courseProductionVersionsInMain, dashboardFlagsInMain, studentDonorInMain, emailReportInMain, exerciseCompletionInMain, feedbacksInMain, interviewSlotInMain, partnerSpecificBatchesV2InMain, mentorTreeInMain, mergedClassesInMain, partnerGroupInMain, partnerGroupRelationshipInMain, partnerGroupUserInMain, partnerRelationshipInMain, partnerUserInMain, pathwayCompletionInMain, partnerSpecificBatchesInMain, pathwaysV2InMain, pathwayCoursesInMain, pathwayCoursesV2InMain, pathwayPartnerGroupInMain, progressParametersInMain, pathwayTrackingFormStructureInMain, progressQuestionsInMain, pathwayTrackingRequestInMain, pathwayTrackingRequestDetailsInMain, pathwayTrackingRequestParameterDetailsInMain, pathwayTrackingRequestQuestionDetailsInMain, pathwaysOngoingTopicInMain, registrationFormDataInMain, registrationFormStructureInMain, sansaarUserRolesInMain, slotBookedInMain, studentDocumentsInMain, studentJobDetailsInMain, studentPathwaysInMain, teacherCapacityBuildingInMain, userTokensInMain, mentorsInMain, merakiCertificateInMain, questionsInMain, questionOptionsInMain, questionBucketsInMain, questionBucketChoicesInMain, recordVersionsOfPostDeleteExercisedetailsInMain, c4CaTeamProjectsubmitSolutionInMain, ongoingTopicsInMain, c4CaTeamProjecttopicInMain, classesToCoursesInMain, courseCompletionV3InMain, pathwayCompletionV2InMain, c4CaTeachersInMain, c4CaStudentsInMain, assessmentsHistoryInMain, exerciseCompletionV2InMain, c4CaStudentsProjectDetailInMain, moduleCompletionV2InMain, assessmentResultInMain, learningTrackStatusInMain, assessmentOutcomeInMain, pathwaysOngoingTopicOutcomeInMain, learningTrackStatusOutcomeInMain, c4CaRolesInMain, zuvyBootcampsInMain, zuvyBatchesInMain, zuvyBootcampTypeInMain, zuvyModuleTrackingInMain, subStageInMain, zuvyCodingSubmissionInMain, zuvyStudentAttendanceInMain, zuvySessionsInMain, zuvyChapterTrackingInMain, zuvyTagsInMain, zuvyOpenEndedQuestionsInMain, zuvyRecentBootcampInMain } from "./schema";

export const cUsersInMainRelations = relations(cUsersInMain, ({one, many}) => ({
	partnersInMain: one(partnersInMain, {
		fields: [cUsersInMain.partnerId],
		references: [partnersInMain.id]
	}),
	feedbacksInMains: many(feedbacksInMain),
	interviewOwnersInMains: many(interviewOwnersInMain),
}));

export const partnersInMainRelations = relations(partnersInMain, ({many}) => ({
	cUsersInMains: many(cUsersInMain),
	usersInMains: many(usersInMain),
	studentsInMains: many(studentsInMain),
	chanakyaPartnerRelationshipInMains: many(chanakyaPartnerRelationshipInMain),
	partnerSpaceInMains: many(partnerSpaceInMain),
	emailReportInMains: many(emailReportInMain),
	partnerSpecificBatchesV2InMains: many(partnerSpecificBatchesV2InMain),
	partnerRelationshipInMains: many(partnerRelationshipInMain),
	partnerUserInMains: many(partnerUserInMain),
	partnerSpecificBatchesInMains: many(partnerSpecificBatchesInMain),
	pathwayPartnerGroupInMains: many(pathwayPartnerGroupInMain),
	registrationFormDataInMains: many(registrationFormDataInMain),
	registrationFormStructureInMains: many(registrationFormStructureInMain),
}));

export const studentsSchoolInMainRelations = relations(studentsSchoolInMain, ({one}) => ({
	schoolInMain: one(schoolInMain, {
		fields: [studentsSchoolInMain.schoolId],
		references: [schoolInMain.id]
	}),
	studentsInMain: one(studentsInMain, {
		fields: [studentsSchoolInMain.studentId],
		references: [studentsInMain.id]
	}),
}));

export const schoolInMainRelations = relations(schoolInMain, ({many}) => ({
	studentsSchoolInMains: many(studentsSchoolInMain),
	schoolStageInMains: many(schoolStageInMain),
	campusSchoolInMains: many(campusSchoolInMain),
}));

export const studentsInMainRelations = relations(studentsInMain, ({one, many}) => ({
	studentsSchoolInMains: many(studentsSchoolInMain),
	studentsStagesInMains: many(studentsStagesInMain),
	enrolmentKeysInMains: many(enrolmentKeysInMain),
	partnersInMain: one(partnersInMain, {
		fields: [studentsInMain.partnerId],
		references: [partnersInMain.id]
	}),
	interviewOwnersInMain: one(interviewOwnersInMain, {
		fields: [studentsInMain.currentOwnerId],
		references: [interviewOwnersInMain.id]
	}),
	schoolStageInMain: one(schoolStageInMain, {
		fields: [studentsInMain.schoolStageId],
		references: [schoolStageInMain.id]
	}),
	stageTransitionsInMains: many(stageTransitionsInMain),
	studentCampusInMains: many(studentCampusInMain),
	dashboardFlagsInMains: many(dashboardFlagsInMain),
	studentDonorInMains: many(studentDonorInMain),
	feedbacksInMains: many(feedbacksInMain),
	interviewSlotInMains: many(interviewSlotInMain),
	slotBookedInMains: many(slotBookedInMain),
	studentDocumentsInMains: many(studentDocumentsInMain),
	studentJobDetailsInMains: many(studentJobDetailsInMain),
}));

export const schoolStageInMainRelations = relations(schoolStageInMain, ({one, many}) => ({
	schoolInMain: one(schoolInMain, {
		fields: [schoolStageInMain.schoolId],
		references: [schoolInMain.id]
	}),
	studentsInMains: many(studentsInMain),
	subStageInMains: many(subStageInMain),
}));

export const campusSchoolInMainRelations = relations(campusSchoolInMain, ({one}) => ({
	campusInMain: one(campusInMain, {
		fields: [campusSchoolInMain.campusId],
		references: [campusInMain.id]
	}),
	schoolInMain: one(schoolInMain, {
		fields: [campusSchoolInMain.schoolId],
		references: [schoolInMain.id]
	}),
}));

export const campusInMainRelations = relations(campusInMain, ({many}) => ({
	campusSchoolInMains: many(campusSchoolInMain),
	studentCampusInMains: many(studentCampusInMain),
}));

export const studentsStagesInMainRelations = relations(studentsStagesInMain, ({one}) => ({
	studentsInMain: one(studentsInMain, {
		fields: [studentsStagesInMain.studentId],
		references: [studentsInMain.id]
	}),
}));

export const engLevelwiseInMainRelations = relations(engLevelwiseInMain, ({one}) => ({
	engArticlesInMain: one(engArticlesInMain, {
		fields: [engLevelwiseInMain.articleId],
		references: [engArticlesInMain.id]
	}),
}));

export const engArticlesInMainRelations = relations(engArticlesInMain, ({many}) => ({
	engLevelwiseInMains: many(engLevelwiseInMain),
	engHistoryInMains: many(engHistoryInMain),
}));

export const engHistoryInMainRelations = relations(engHistoryInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [engHistoryInMain.userId],
		references: [usersInMain.id]
	}),
	engArticlesInMain: one(engArticlesInMain, {
		fields: [engHistoryInMain.engArticlesId],
		references: [engArticlesInMain.id]
	}),
}));

export const usersInMainRelations = relations(usersInMain, ({one, many}) => ({
	engHistoryInMains: many(engHistoryInMain),
	userRolesInMains: many(userRolesInMain),
	exercisesHistoryInMains: many(exercisesHistoryInMain),
	partnersInMain: one(partnersInMain, {
		fields: [usersInMain.partnerId],
		references: [partnersInMain.id]
	}),
	partnerSpaceInMain: one(partnerSpaceInMain, {
		fields: [usersInMain.spaceId],
		references: [partnerSpaceInMain.id]
	}),
	spaceGroupInMain: one(spaceGroupInMain, {
		fields: [usersInMain.groupId],
		references: [spaceGroupInMain.id]
	}),
	c4CaPartnersInMain: one(c4CaPartnersInMain, {
		fields: [usersInMain.c4CaPartnerId],
		references: [c4CaPartnersInMain.id]
	}),
	facilitatorsInMain: one(facilitatorsInMain, {
		fields: [usersInMain.c4CaFacilitatorId],
		references: [facilitatorsInMain.id]
	}),
	courseEnrolmentsInMains: many(courseEnrolmentsInMain),
	classRegistrationsInMains: many(classRegistrationsInMain),
	volunteerInMains: many(volunteerInMain),
	courseCompletionInMains: many(courseCompletionInMain),
	courseCompletionV2InMains: many(courseCompletionV2InMain),
	courseEditorStatusInMains: many(courseEditorStatusInMain),
	exerciseCompletionInMains: many(exerciseCompletionInMain),
	mentorTreeInMains_mentorId: many(mentorTreeInMain, {
		relationName: "mentorTreeInMain_mentorId_usersInMain_id"
	}),
	mentorTreeInMains_menteeId: many(mentorTreeInMain, {
		relationName: "mentorTreeInMain_menteeId_usersInMain_id"
	}),
	pathwayCompletionInMains: many(pathwayCompletionInMain),
	pathwayTrackingRequestDetailsInMains_mentorId: many(pathwayTrackingRequestDetailsInMain, {
		relationName: "pathwayTrackingRequestDetailsInMain_mentorId_usersInMain_id"
	}),
	pathwayTrackingRequestDetailsInMains_menteeId: many(pathwayTrackingRequestDetailsInMain, {
		relationName: "pathwayTrackingRequestDetailsInMain_menteeId_usersInMain_id"
	}),
	pathwayTrackingRequestInMains_mentorId: many(pathwayTrackingRequestInMain, {
		relationName: "pathwayTrackingRequestInMain_mentorId_usersInMain_id"
	}),
	pathwayTrackingRequestInMains_menteeId: many(pathwayTrackingRequestInMain, {
		relationName: "pathwayTrackingRequestInMain_menteeId_usersInMain_id"
	}),
	pathwaysOngoingTopicInMains: many(pathwaysOngoingTopicInMain),
	sansaarUserRolesInMains: many(sansaarUserRolesInMain),
	studentPathwaysInMains: many(studentPathwaysInMain),
	teacherCapacityBuildingInMains: many(teacherCapacityBuildingInMain),
	userTokensInMains_userId: many(userTokensInMain, {
		relationName: "userTokensInMain_userId_usersInMain_id"
	}),
	userTokensInMains_userEmail: many(userTokensInMain, {
		relationName: "userTokensInMain_userEmail_usersInMain_email"
	}),
	mentorsInMains_mentor: many(mentorsInMain, {
		relationName: "mentorsInMain_mentor_usersInMain_id"
	}),
	mentorsInMains_mentee: many(mentorsInMain, {
		relationName: "mentorsInMain_mentee_usersInMain_id"
	}),
	mentorsInMains_userId: many(mentorsInMain, {
		relationName: "mentorsInMain_userId_usersInMain_id"
	}),
	merakiCertificateInMains: many(merakiCertificateInMain),
	ongoingTopicsInMains: many(ongoingTopicsInMain),
	courseCompletionV3InMains: many(courseCompletionV3InMain),
	pathwayCompletionV2InMains: many(pathwayCompletionV2InMain),
	assessmentsHistoryInMains: many(assessmentsHistoryInMain),
	exerciseCompletionV2InMains: many(exerciseCompletionV2InMain),
	moduleCompletionV2InMains: many(moduleCompletionV2InMain),
	assessmentResultInMains: many(assessmentResultInMain),
	learningTrackStatusInMains: many(learningTrackStatusInMain),
	c4CaTeachersInMains: many(c4CaTeachersInMain),
	assessmentOutcomeInMains: many(assessmentOutcomeInMain),
	pathwaysOngoingTopicOutcomeInMains: many(pathwaysOngoingTopicOutcomeInMain),
	learningTrackStatusOutcomeInMains: many(learningTrackStatusOutcomeInMain),
	c4CaRolesInMains: many(c4CaRolesInMain),
	zuvyBatchesInMains: many(zuvyBatchesInMain),
	zuvyModuleTrackingInMains: many(zuvyModuleTrackingInMain),
	zuvyCodingSubmissionInMains: many(zuvyCodingSubmissionInMain),
	zuvyChapterTrackingInMains: many(zuvyChapterTrackingInMain),
	zuvyRecentBootcampInMains: many(zuvyRecentBootcampInMain),
}));

export const userRolesInMainRelations = relations(userRolesInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [userRolesInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const exercisesHistoryInMainRelations = relations(exercisesHistoryInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [exercisesHistoryInMain.userId],
		references: [usersInMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [exercisesHistoryInMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const c4CaTeamsInMainRelations = relations(c4CaTeamsInMain, ({one, many}) => ({
	exercisesHistoryInMains: many(exercisesHistoryInMain),
	ongoingTopicsInMains: many(ongoingTopicsInMain),
	courseCompletionV3InMains: many(courseCompletionV3InMain),
	pathwayCompletionV2InMains: many(pathwayCompletionV2InMain),
	assessmentsHistoryInMains: many(assessmentsHistoryInMain),
	exerciseCompletionV2InMains: many(exerciseCompletionV2InMain),
	c4CaStudentsProjectDetailInMains: many(c4CaStudentsProjectDetailInMain),
	moduleCompletionV2InMains: many(moduleCompletionV2InMain),
	assessmentResultInMains: many(assessmentResultInMain),
	learningTrackStatusInMains: many(learningTrackStatusInMain),
	assessmentOutcomeInMains: many(assessmentOutcomeInMain),
	c4CaTeamProjectsubmitSolutionInMains: many(c4CaTeamProjectsubmitSolutionInMain),
	c4CaTeamProjecttopicInMains: many(c4CaTeamProjecttopicInMain),
	c4CaTeachersInMain: one(c4CaTeachersInMain, {
		fields: [c4CaTeamsInMain.teacherId],
		references: [c4CaTeachersInMain.id]
	}),
	learningTrackStatusOutcomeInMains: many(learningTrackStatusOutcomeInMain),
}));

export const partnerSpaceInMainRelations = relations(partnerSpaceInMain, ({one, many}) => ({
	usersInMains: many(usersInMain),
	partnersInMain: one(partnersInMain, {
		fields: [partnerSpaceInMain.partnerId],
		references: [partnersInMain.id]
	}),
	spaceGroupInMains: many(spaceGroupInMain),
	partnerSpecificBatchesInMains: many(partnerSpecificBatchesInMain),
}));

export const spaceGroupInMainRelations = relations(spaceGroupInMain, ({one, many}) => ({
	usersInMains: many(usersInMain),
	partnerSpaceInMain: one(partnerSpaceInMain, {
		fields: [spaceGroupInMain.spaceId],
		references: [partnerSpaceInMain.id]
	}),
	partnerSpecificBatchesInMains: many(partnerSpecificBatchesInMain),
}));

export const c4CaPartnersInMainRelations = relations(c4CaPartnersInMain, ({many}) => ({
	usersInMains: many(usersInMain),
	c4CaTeachersInMains: many(c4CaTeachersInMain),
	facilitatorsInMains: many(facilitatorsInMain),
}));

export const facilitatorsInMainRelations = relations(facilitatorsInMain, ({one, many}) => ({
	usersInMains: many(usersInMain),
	c4CaPartnersInMain: one(c4CaPartnersInMain, {
		fields: [facilitatorsInMain.c4CaPartnerId],
		references: [c4CaPartnersInMain.id]
	}),
}));

export const incomingCallsInMainRelations = relations(incomingCallsInMain, ({one}) => ({
	contactsInMain: one(contactsInMain, {
		fields: [incomingCallsInMain.contactId],
		references: [contactsInMain.id]
	}),
}));

export const contactsInMainRelations = relations(contactsInMain, ({many}) => ({
	incomingCallsInMains: many(incomingCallsInMain),
}));

export const courseEnrolmentsInMainRelations = relations(courseEnrolmentsInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [courseEnrolmentsInMain.studentId],
		references: [usersInMain.id]
	}),
	coursesInMain: one(coursesInMain, {
		fields: [courseEnrolmentsInMain.courseId],
		references: [coursesInMain.id]
	}),
}));

export const coursesInMainRelations = relations(coursesInMain, ({many}) => ({
	courseEnrolmentsInMains: many(courseEnrolmentsInMain),
	courseRelationInMains_courseId: many(courseRelationInMain, {
		relationName: "courseRelationInMain_courseId_coursesInMain_id"
	}),
	courseRelationInMains_reliesOn: many(courseRelationInMain, {
		relationName: "courseRelationInMain_reliesOn_coursesInMain_id"
	}),
	exercisesInMains: many(exercisesInMain),
	courseCategoriesInMains: many(courseCategoriesInMain),
	courseCompletionInMains: many(courseCompletionInMain),
	pathwayCoursesInMains: many(pathwayCoursesInMain),
	classesToCoursesInMains: many(classesToCoursesInMain),
}));

export const courseRelationInMainRelations = relations(courseRelationInMain, ({one}) => ({
	coursesInMain_courseId: one(coursesInMain, {
		fields: [courseRelationInMain.courseId],
		references: [coursesInMain.id],
		relationName: "courseRelationInMain_courseId_coursesInMain_id"
	}),
	coursesInMain_reliesOn: one(coursesInMain, {
		fields: [courseRelationInMain.reliesOn],
		references: [coursesInMain.id],
		relationName: "courseRelationInMain_reliesOn_coursesInMain_id"
	}),
}));

export const questionSetsInMainRelations = relations(questionSetsInMain, ({one, many}) => ({
	testVersionsInMain: one(testVersionsInMain, {
		fields: [questionSetsInMain.versionId],
		references: [testVersionsInMain.id]
	}),
	enrolmentKeysInMains: many(enrolmentKeysInMain),
}));

export const testVersionsInMainRelations = relations(testVersionsInMain, ({many}) => ({
	questionSetsInMains: many(questionSetsInMain),
}));

export const enrolmentKeysInMainRelations = relations(enrolmentKeysInMain, ({one}) => ({
	studentsInMain: one(studentsInMain, {
		fields: [enrolmentKeysInMain.studentId],
		references: [studentsInMain.id]
	}),
	questionSetsInMain: one(questionSetsInMain, {
		fields: [enrolmentKeysInMain.questionSetId],
		references: [questionSetsInMain.id]
	}),
}));

export const exercisesInMainRelations = relations(exercisesInMain, ({one, many}) => ({
	coursesInMain: one(coursesInMain, {
		fields: [exercisesInMain.courseId],
		references: [coursesInMain.id]
	}),
	exerciseCompletionInMains: many(exerciseCompletionInMain),
	classesToCoursesInMains: many(classesToCoursesInMain),
}));

export const assessmentInMainRelations = relations(assessmentInMain, ({one, many}) => ({
	coursesV2InMain: one(coursesV2InMain, {
		fields: [assessmentInMain.courseId],
		references: [coursesV2InMain.id]
	}),
	exercisesV2InMain: one(exercisesV2InMain, {
		fields: [assessmentInMain.exerciseId],
		references: [exercisesV2InMain.id]
	}),
	pathwaysOngoingTopicInMains: many(pathwaysOngoingTopicInMain),
	assessmentResultInMains: many(assessmentResultInMain),
}));

export const coursesV2InMainRelations = relations(coursesV2InMain, ({many}) => ({
	assessmentInMains: many(assessmentInMain),
	exercisesV2InMains: many(exercisesV2InMain),
	courseCompletionV2InMains: many(courseCompletionV2InMain),
	courseEditorStatusInMains: many(courseEditorStatusInMain),
	courseProductionVersionsInMains: many(courseProductionVersionsInMain),
	pathwayCoursesV2InMains: many(pathwayCoursesV2InMain),
	pathwaysOngoingTopicInMains: many(pathwaysOngoingTopicInMain),
	recordVersionsOfPostDeleteExercisedetailsInMains: many(recordVersionsOfPostDeleteExercisedetailsInMain),
	classesToCoursesInMains: many(classesToCoursesInMain),
}));

export const exercisesV2InMainRelations = relations(exercisesV2InMain, ({one, many}) => ({
	assessmentInMains: many(assessmentInMain),
	coursesV2InMain: one(coursesV2InMain, {
		fields: [exercisesV2InMain.courseId],
		references: [coursesV2InMain.id]
	}),
	pathwaysOngoingTopicInMains: many(pathwaysOngoingTopicInMain),
	recordVersionsOfPostDeleteExercisedetailsInMains: many(recordVersionsOfPostDeleteExercisedetailsInMain),
	classesToCoursesInMains: many(classesToCoursesInMain),
	learningTrackStatusInMains: many(learningTrackStatusInMain),
}));

export const interviewOwnersInMainRelations = relations(interviewOwnersInMain, ({one, many}) => ({
	studentsInMains: many(studentsInMain),
	cUsersInMain: one(cUsersInMain, {
		fields: [interviewOwnersInMain.userId],
		references: [cUsersInMain.id]
	}),
	interviewSlotInMains: many(interviewSlotInMain),
}));

export const stageTransitionsInMainRelations = relations(stageTransitionsInMain, ({one, many}) => ({
	studentsInMain: one(studentsInMain, {
		fields: [stageTransitionsInMain.studentId],
		references: [studentsInMain.id]
	}),
	interviewSlotInMains: many(interviewSlotInMain),
}));

export const studentCampusInMainRelations = relations(studentCampusInMain, ({one}) => ({
	studentsInMain: one(studentsInMain, {
		fields: [studentCampusInMain.studentId],
		references: [studentsInMain.id]
	}),
	campusInMain: one(campusInMain, {
		fields: [studentCampusInMain.campusId],
		references: [campusInMain.id]
	}),
}));

export const chanakyaUserRolesInMainRelations = relations(chanakyaUserRolesInMain, ({one, many}) => ({
	chanakyaRolesInMain: one(chanakyaRolesInMain, {
		fields: [chanakyaUserRolesInMain.roles],
		references: [chanakyaRolesInMain.id]
	}),
	chanakyaPrivilegeInMain: one(chanakyaPrivilegeInMain, {
		fields: [chanakyaUserRolesInMain.privilege],
		references: [chanakyaPrivilegeInMain.id]
	}),
	chanakyaAccessInMains: many(chanakyaAccessInMain),
}));

export const chanakyaRolesInMainRelations = relations(chanakyaRolesInMain, ({many}) => ({
	chanakyaUserRolesInMains: many(chanakyaUserRolesInMain),
}));

export const chanakyaPrivilegeInMainRelations = relations(chanakyaPrivilegeInMain, ({many}) => ({
	chanakyaUserRolesInMains: many(chanakyaUserRolesInMain),
}));

export const chanakyaAccessInMainRelations = relations(chanakyaAccessInMain, ({one}) => ({
	chanakyaUserRolesInMain: one(chanakyaUserRolesInMain, {
		fields: [chanakyaAccessInMain.userRoleId],
		references: [chanakyaUserRolesInMain.id]
	}),
}));

export const chanakyaPartnerRelationshipInMainRelations = relations(chanakyaPartnerRelationshipInMain, ({one}) => ({
	chanakyaPartnerGroupInMain: one(chanakyaPartnerGroupInMain, {
		fields: [chanakyaPartnerRelationshipInMain.partnerGroupId],
		references: [chanakyaPartnerGroupInMain.id]
	}),
	partnersInMain: one(partnersInMain, {
		fields: [chanakyaPartnerRelationshipInMain.partnerId],
		references: [partnersInMain.id]
	}),
}));

export const chanakyaPartnerGroupInMainRelations = relations(chanakyaPartnerGroupInMain, ({many}) => ({
	chanakyaPartnerRelationshipInMains: many(chanakyaPartnerRelationshipInMain),
}));

export const classesInMainRelations = relations(classesInMain, ({one, many}) => ({
	categoryInMain: one(categoryInMain, {
		fields: [classesInMain.categoryId],
		references: [categoryInMain.id]
	}),
	recurringClassesInMain: one(recurringClassesInMain, {
		fields: [classesInMain.recurringId],
		references: [recurringClassesInMain.id]
	}),
	volunteerInMain: one(volunteerInMain, {
		fields: [classesInMain.volunteerId],
		references: [volunteerInMain.id]
	}),
	classRegistrationsInMains: many(classRegistrationsInMain),
	classesMailInMains: many(classesMailInMain),
	partnerSpecificBatchesV2InMains: many(partnerSpecificBatchesV2InMain),
	mergedClassesInMains_classId: many(mergedClassesInMain, {
		relationName: "mergedClassesInMain_classId_classesInMain_id"
	}),
	mergedClassesInMains_mergedClassId: many(mergedClassesInMain, {
		relationName: "mergedClassesInMain_mergedClassId_classesInMain_id"
	}),
	partnerSpecificBatchesInMains: many(partnerSpecificBatchesInMain),
	classesToCoursesInMains: many(classesToCoursesInMain),
}));

export const categoryInMainRelations = relations(categoryInMain, ({many}) => ({
	classesInMains: many(classesInMain),
	courseCategoriesInMains: many(courseCategoriesInMain),
}));

export const recurringClassesInMainRelations = relations(recurringClassesInMain, ({many}) => ({
	classesInMains: many(classesInMain),
	partnerSpecificBatchesV2InMains: many(partnerSpecificBatchesV2InMain),
	partnerSpecificBatchesInMains: many(partnerSpecificBatchesInMain),
}));

export const volunteerInMainRelations = relations(volunteerInMain, ({one, many}) => ({
	classesInMains: many(classesInMain),
	usersInMain: one(usersInMain, {
		fields: [volunteerInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const classRegistrationsInMainRelations = relations(classRegistrationsInMain, ({one}) => ({
	classesInMain: one(classesInMain, {
		fields: [classRegistrationsInMain.classId],
		references: [classesInMain.id]
	}),
	usersInMain: one(usersInMain, {
		fields: [classRegistrationsInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const classesMailInMainRelations = relations(classesMailInMain, ({one}) => ({
	classesInMain: one(classesInMain, {
		fields: [classesMailInMain.classId],
		references: [classesInMain.id]
	}),
}));

export const courseCategoriesInMainRelations = relations(courseCategoriesInMain, ({one}) => ({
	coursesInMain: one(coursesInMain, {
		fields: [courseCategoriesInMain.courseId],
		references: [coursesInMain.id]
	}),
	categoryInMain: one(categoryInMain, {
		fields: [courseCategoriesInMain.categoryId],
		references: [categoryInMain.id]
	}),
}));

export const courseCompletionInMainRelations = relations(courseCompletionInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [courseCompletionInMain.userId],
		references: [usersInMain.id]
	}),
	coursesInMain: one(coursesInMain, {
		fields: [courseCompletionInMain.courseId],
		references: [coursesInMain.id]
	}),
}));

export const courseCompletionV2InMainRelations = relations(courseCompletionV2InMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [courseCompletionV2InMain.userId],
		references: [usersInMain.id]
	}),
	coursesV2InMain: one(coursesV2InMain, {
		fields: [courseCompletionV2InMain.courseId],
		references: [coursesV2InMain.id]
	}),
}));

export const courseEditorStatusInMainRelations = relations(courseEditorStatusInMain, ({one}) => ({
	coursesV2InMain: one(coursesV2InMain, {
		fields: [courseEditorStatusInMain.courseId],
		references: [coursesV2InMain.id]
	}),
	usersInMain: one(usersInMain, {
		fields: [courseEditorStatusInMain.contentEditorsUserId],
		references: [usersInMain.id]
	}),
}));

export const courseProductionVersionsInMainRelations = relations(courseProductionVersionsInMain, ({one}) => ({
	coursesV2InMain: one(coursesV2InMain, {
		fields: [courseProductionVersionsInMain.courseId],
		references: [coursesV2InMain.id]
	}),
}));

export const dashboardFlagsInMainRelations = relations(dashboardFlagsInMain, ({one}) => ({
	studentsInMain: one(studentsInMain, {
		fields: [dashboardFlagsInMain.studentId],
		references: [studentsInMain.id]
	}),
}));

export const studentDonorInMainRelations = relations(studentDonorInMain, ({one}) => ({
	studentsInMain: one(studentsInMain, {
		fields: [studentDonorInMain.studentId],
		references: [studentsInMain.id]
	}),
}));

export const emailReportInMainRelations = relations(emailReportInMain, ({one}) => ({
	partnersInMain: one(partnersInMain, {
		fields: [emailReportInMain.partnerId],
		references: [partnersInMain.id]
	}),
}));

export const exerciseCompletionInMainRelations = relations(exerciseCompletionInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [exerciseCompletionInMain.userId],
		references: [usersInMain.id]
	}),
	exercisesInMain: one(exercisesInMain, {
		fields: [exerciseCompletionInMain.exerciseId],
		references: [exercisesInMain.id]
	}),
}));

export const feedbacksInMainRelations = relations(feedbacksInMain, ({one}) => ({
	studentsInMain: one(studentsInMain, {
		fields: [feedbacksInMain.studentId],
		references: [studentsInMain.id]
	}),
	cUsersInMain: one(cUsersInMain, {
		fields: [feedbacksInMain.userId],
		references: [cUsersInMain.id]
	}),
}));

export const interviewSlotInMainRelations = relations(interviewSlotInMain, ({one, many}) => ({
	interviewOwnersInMain: one(interviewOwnersInMain, {
		fields: [interviewSlotInMain.ownerId],
		references: [interviewOwnersInMain.id]
	}),
	studentsInMain: one(studentsInMain, {
		fields: [interviewSlotInMain.studentId],
		references: [studentsInMain.id]
	}),
	stageTransitionsInMain: one(stageTransitionsInMain, {
		fields: [interviewSlotInMain.transitionId],
		references: [stageTransitionsInMain.id]
	}),
	slotBookedInMains: many(slotBookedInMain),
}));

export const partnerSpecificBatchesV2InMainRelations = relations(partnerSpecificBatchesV2InMain, ({one}) => ({
	recurringClassesInMain: one(recurringClassesInMain, {
		fields: [partnerSpecificBatchesV2InMain.recurringId],
		references: [recurringClassesInMain.id]
	}),
	classesInMain: one(classesInMain, {
		fields: [partnerSpecificBatchesV2InMain.classId],
		references: [classesInMain.id]
	}),
	partnersInMain: one(partnersInMain, {
		fields: [partnerSpecificBatchesV2InMain.partnerId],
		references: [partnersInMain.id]
	}),
}));

export const mentorTreeInMainRelations = relations(mentorTreeInMain, ({one}) => ({
	usersInMain_mentorId: one(usersInMain, {
		fields: [mentorTreeInMain.mentorId],
		references: [usersInMain.id],
		relationName: "mentorTreeInMain_mentorId_usersInMain_id"
	}),
	usersInMain_menteeId: one(usersInMain, {
		fields: [mentorTreeInMain.menteeId],
		references: [usersInMain.id],
		relationName: "mentorTreeInMain_menteeId_usersInMain_id"
	}),
}));

export const mergedClassesInMainRelations = relations(mergedClassesInMain, ({one}) => ({
	classesInMain_classId: one(classesInMain, {
		fields: [mergedClassesInMain.classId],
		references: [classesInMain.id],
		relationName: "mergedClassesInMain_classId_classesInMain_id"
	}),
	classesInMain_mergedClassId: one(classesInMain, {
		fields: [mergedClassesInMain.mergedClassId],
		references: [classesInMain.id],
		relationName: "mergedClassesInMain_mergedClassId_classesInMain_id"
	}),
}));

export const partnerGroupRelationshipInMainRelations = relations(partnerGroupRelationshipInMain, ({one}) => ({
	partnerGroupInMain: one(partnerGroupInMain, {
		fields: [partnerGroupRelationshipInMain.partnerGroupId],
		references: [partnerGroupInMain.id]
	}),
}));

export const partnerGroupInMainRelations = relations(partnerGroupInMain, ({many}) => ({
	partnerGroupRelationshipInMains: many(partnerGroupRelationshipInMain),
	partnerGroupUserInMains: many(partnerGroupUserInMain),
	partnerRelationshipInMains: many(partnerRelationshipInMain),
}));

export const partnerGroupUserInMainRelations = relations(partnerGroupUserInMain, ({one}) => ({
	partnerGroupInMain: one(partnerGroupInMain, {
		fields: [partnerGroupUserInMain.partnerGroupId],
		references: [partnerGroupInMain.id]
	}),
}));

export const partnerRelationshipInMainRelations = relations(partnerRelationshipInMain, ({one}) => ({
	partnersInMain: one(partnersInMain, {
		fields: [partnerRelationshipInMain.partnerId],
		references: [partnersInMain.id]
	}),
	partnerGroupInMain: one(partnerGroupInMain, {
		fields: [partnerRelationshipInMain.partnerGroupId],
		references: [partnerGroupInMain.id]
	}),
}));

export const partnerUserInMainRelations = relations(partnerUserInMain, ({one}) => ({
	partnersInMain: one(partnersInMain, {
		fields: [partnerUserInMain.partnerId],
		references: [partnersInMain.id]
	}),
}));

export const pathwayCompletionInMainRelations = relations(pathwayCompletionInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [pathwayCompletionInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const partnerSpecificBatchesInMainRelations = relations(partnerSpecificBatchesInMain, ({one}) => ({
	classesInMain: one(classesInMain, {
		fields: [partnerSpecificBatchesInMain.classId],
		references: [classesInMain.id]
	}),
	recurringClassesInMain: one(recurringClassesInMain, {
		fields: [partnerSpecificBatchesInMain.recurringId],
		references: [recurringClassesInMain.id]
	}),
	partnersInMain: one(partnersInMain, {
		fields: [partnerSpecificBatchesInMain.partnerId],
		references: [partnersInMain.id]
	}),
	spaceGroupInMain: one(spaceGroupInMain, {
		fields: [partnerSpecificBatchesInMain.groupId],
		references: [spaceGroupInMain.id]
	}),
	pathwaysV2InMain: one(pathwaysV2InMain, {
		fields: [partnerSpecificBatchesInMain.pathwayId],
		references: [pathwaysV2InMain.id]
	}),
	partnerSpaceInMain: one(partnerSpaceInMain, {
		fields: [partnerSpecificBatchesInMain.spaceId],
		references: [partnerSpaceInMain.id]
	}),
}));

export const pathwaysV2InMainRelations = relations(pathwaysV2InMain, ({many}) => ({
	partnerSpecificBatchesInMains: many(partnerSpecificBatchesInMain),
	pathwayCoursesV2InMains: many(pathwayCoursesV2InMain),
	pathwayPartnerGroupInMains: many(pathwayPartnerGroupInMain),
	pathwaysOngoingTopicInMains: many(pathwaysOngoingTopicInMain),
	classesToCoursesInMains: many(classesToCoursesInMain),
}));

export const pathwayCoursesInMainRelations = relations(pathwayCoursesInMain, ({one}) => ({
	coursesInMain: one(coursesInMain, {
		fields: [pathwayCoursesInMain.courseId],
		references: [coursesInMain.id]
	}),
}));

export const pathwayCoursesV2InMainRelations = relations(pathwayCoursesV2InMain, ({one}) => ({
	coursesV2InMain: one(coursesV2InMain, {
		fields: [pathwayCoursesV2InMain.courseId],
		references: [coursesV2InMain.id]
	}),
	pathwaysV2InMain: one(pathwaysV2InMain, {
		fields: [pathwayCoursesV2InMain.pathwayId],
		references: [pathwaysV2InMain.id]
	}),
}));

export const pathwayPartnerGroupInMainRelations = relations(pathwayPartnerGroupInMain, ({one}) => ({
	partnersInMain: one(partnersInMain, {
		fields: [pathwayPartnerGroupInMain.partnerId],
		references: [partnersInMain.id]
	}),
	pathwaysV2InMain: one(pathwaysV2InMain, {
		fields: [pathwayPartnerGroupInMain.pathwayId],
		references: [pathwaysV2InMain.id]
	}),
}));

export const pathwayTrackingFormStructureInMainRelations = relations(pathwayTrackingFormStructureInMain, ({one}) => ({
	progressParametersInMain: one(progressParametersInMain, {
		fields: [pathwayTrackingFormStructureInMain.parameterId],
		references: [progressParametersInMain.id]
	}),
	progressQuestionsInMain: one(progressQuestionsInMain, {
		fields: [pathwayTrackingFormStructureInMain.questionId],
		references: [progressQuestionsInMain.id]
	}),
}));

export const progressParametersInMainRelations = relations(progressParametersInMain, ({many}) => ({
	pathwayTrackingFormStructureInMains: many(pathwayTrackingFormStructureInMain),
	pathwayTrackingRequestParameterDetailsInMains: many(pathwayTrackingRequestParameterDetailsInMain),
}));

export const progressQuestionsInMainRelations = relations(progressQuestionsInMain, ({many}) => ({
	pathwayTrackingFormStructureInMains: many(pathwayTrackingFormStructureInMain),
	pathwayTrackingRequestQuestionDetailsInMains: many(pathwayTrackingRequestQuestionDetailsInMain),
}));

export const pathwayTrackingRequestDetailsInMainRelations = relations(pathwayTrackingRequestDetailsInMain, ({one}) => ({
	pathwayTrackingRequestInMain: one(pathwayTrackingRequestInMain, {
		fields: [pathwayTrackingRequestDetailsInMain.requestId],
		references: [pathwayTrackingRequestInMain.id]
	}),
	usersInMain_mentorId: one(usersInMain, {
		fields: [pathwayTrackingRequestDetailsInMain.mentorId],
		references: [usersInMain.id],
		relationName: "pathwayTrackingRequestDetailsInMain_mentorId_usersInMain_id"
	}),
	usersInMain_menteeId: one(usersInMain, {
		fields: [pathwayTrackingRequestDetailsInMain.menteeId],
		references: [usersInMain.id],
		relationName: "pathwayTrackingRequestDetailsInMain_menteeId_usersInMain_id"
	}),
}));

export const pathwayTrackingRequestInMainRelations = relations(pathwayTrackingRequestInMain, ({one, many}) => ({
	pathwayTrackingRequestDetailsInMains: many(pathwayTrackingRequestDetailsInMain),
	usersInMain_mentorId: one(usersInMain, {
		fields: [pathwayTrackingRequestInMain.mentorId],
		references: [usersInMain.id],
		relationName: "pathwayTrackingRequestInMain_mentorId_usersInMain_id"
	}),
	usersInMain_menteeId: one(usersInMain, {
		fields: [pathwayTrackingRequestInMain.menteeId],
		references: [usersInMain.id],
		relationName: "pathwayTrackingRequestInMain_menteeId_usersInMain_id"
	}),
}));

export const pathwayTrackingRequestParameterDetailsInMainRelations = relations(pathwayTrackingRequestParameterDetailsInMain, ({one}) => ({
	progressParametersInMain: one(progressParametersInMain, {
		fields: [pathwayTrackingRequestParameterDetailsInMain.parameterId],
		references: [progressParametersInMain.id]
	}),
}));

export const pathwayTrackingRequestQuestionDetailsInMainRelations = relations(pathwayTrackingRequestQuestionDetailsInMain, ({one}) => ({
	progressQuestionsInMain: one(progressQuestionsInMain, {
		fields: [pathwayTrackingRequestQuestionDetailsInMain.questionId],
		references: [progressQuestionsInMain.id]
	}),
}));

export const pathwaysOngoingTopicInMainRelations = relations(pathwaysOngoingTopicInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [pathwaysOngoingTopicInMain.userId],
		references: [usersInMain.id]
	}),
	pathwaysV2InMain: one(pathwaysV2InMain, {
		fields: [pathwaysOngoingTopicInMain.pathwayId],
		references: [pathwaysV2InMain.id]
	}),
	coursesV2InMain: one(coursesV2InMain, {
		fields: [pathwaysOngoingTopicInMain.courseId],
		references: [coursesV2InMain.id]
	}),
	exercisesV2InMain: one(exercisesV2InMain, {
		fields: [pathwaysOngoingTopicInMain.exerciseId],
		references: [exercisesV2InMain.id]
	}),
	assessmentInMain: one(assessmentInMain, {
		fields: [pathwaysOngoingTopicInMain.assessmentId],
		references: [assessmentInMain.id]
	}),
}));

export const registrationFormDataInMainRelations = relations(registrationFormDataInMain, ({one}) => ({
	partnersInMain: one(partnersInMain, {
		fields: [registrationFormDataInMain.partnerId],
		references: [partnersInMain.id]
	}),
}));

export const registrationFormStructureInMainRelations = relations(registrationFormStructureInMain, ({one}) => ({
	partnersInMain: one(partnersInMain, {
		fields: [registrationFormStructureInMain.partnerId],
		references: [partnersInMain.id]
	}),
}));

export const sansaarUserRolesInMainRelations = relations(sansaarUserRolesInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [sansaarUserRolesInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const slotBookedInMainRelations = relations(slotBookedInMain, ({one}) => ({
	interviewSlotInMain: one(interviewSlotInMain, {
		fields: [slotBookedInMain.interviewSlotId],
		references: [interviewSlotInMain.id]
	}),
	studentsInMain: one(studentsInMain, {
		fields: [slotBookedInMain.studentId],
		references: [studentsInMain.id]
	}),
}));

export const studentDocumentsInMainRelations = relations(studentDocumentsInMain, ({one}) => ({
	studentsInMain: one(studentsInMain, {
		fields: [studentDocumentsInMain.studentId],
		references: [studentsInMain.id]
	}),
}));

export const studentJobDetailsInMainRelations = relations(studentJobDetailsInMain, ({one}) => ({
	studentsInMain: one(studentsInMain, {
		fields: [studentJobDetailsInMain.studentId],
		references: [studentsInMain.id]
	}),
}));

export const studentPathwaysInMainRelations = relations(studentPathwaysInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [studentPathwaysInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const teacherCapacityBuildingInMainRelations = relations(teacherCapacityBuildingInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [teacherCapacityBuildingInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const userTokensInMainRelations = relations(userTokensInMain, ({one}) => ({
	usersInMain_userId: one(usersInMain, {
		fields: [userTokensInMain.userId],
		references: [usersInMain.id],
		relationName: "userTokensInMain_userId_usersInMain_id"
	}),
	usersInMain_userEmail: one(usersInMain, {
		fields: [userTokensInMain.userEmail],
		references: [usersInMain.email],
		relationName: "userTokensInMain_userEmail_usersInMain_email"
	}),
}));

export const mentorsInMainRelations = relations(mentorsInMain, ({one}) => ({
	usersInMain_mentor: one(usersInMain, {
		fields: [mentorsInMain.mentor],
		references: [usersInMain.id],
		relationName: "mentorsInMain_mentor_usersInMain_id"
	}),
	usersInMain_mentee: one(usersInMain, {
		fields: [mentorsInMain.mentee],
		references: [usersInMain.id],
		relationName: "mentorsInMain_mentee_usersInMain_id"
	}),
	usersInMain_userId: one(usersInMain, {
		fields: [mentorsInMain.userId],
		references: [usersInMain.id],
		relationName: "mentorsInMain_userId_usersInMain_id"
	}),
}));

export const merakiCertificateInMainRelations = relations(merakiCertificateInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [merakiCertificateInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const questionOptionsInMainRelations = relations(questionOptionsInMain, ({one}) => ({
	questionsInMain: one(questionsInMain, {
		fields: [questionOptionsInMain.questionId],
		references: [questionsInMain.id]
	}),
}));

export const questionsInMainRelations = relations(questionsInMain, ({many}) => ({
	questionOptionsInMains: many(questionOptionsInMain),
}));

export const questionBucketChoicesInMainRelations = relations(questionBucketChoicesInMain, ({one}) => ({
	questionBucketsInMain: one(questionBucketsInMain, {
		fields: [questionBucketChoicesInMain.bucketId],
		references: [questionBucketsInMain.id]
	}),
}));

export const questionBucketsInMainRelations = relations(questionBucketsInMain, ({many}) => ({
	questionBucketChoicesInMains: many(questionBucketChoicesInMain),
}));

export const recordVersionsOfPostDeleteExercisedetailsInMainRelations = relations(recordVersionsOfPostDeleteExercisedetailsInMain, ({one}) => ({
	coursesV2InMain: one(coursesV2InMain, {
		fields: [recordVersionsOfPostDeleteExercisedetailsInMain.courseId],
		references: [coursesV2InMain.id]
	}),
	exercisesV2InMain: one(exercisesV2InMain, {
		fields: [recordVersionsOfPostDeleteExercisedetailsInMain.exerciseId],
		references: [exercisesV2InMain.id]
	}),
}));

export const ongoingTopicsInMainRelations = relations(ongoingTopicsInMain, ({one}) => ({
	c4CaTeamProjectsubmitSolutionInMain: one(c4CaTeamProjectsubmitSolutionInMain, {
		fields: [ongoingTopicsInMain.projectSolutionId],
		references: [c4CaTeamProjectsubmitSolutionInMain.id]
	}),
	usersInMain: one(usersInMain, {
		fields: [ongoingTopicsInMain.userId],
		references: [usersInMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [ongoingTopicsInMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
	c4CaTeamProjecttopicInMain: one(c4CaTeamProjecttopicInMain, {
		fields: [ongoingTopicsInMain.projectTopicId],
		references: [c4CaTeamProjecttopicInMain.id]
	}),
}));

export const c4CaTeamProjectsubmitSolutionInMainRelations = relations(c4CaTeamProjectsubmitSolutionInMain, ({one, many}) => ({
	ongoingTopicsInMains: many(ongoingTopicsInMain),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [c4CaTeamProjectsubmitSolutionInMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const c4CaTeamProjecttopicInMainRelations = relations(c4CaTeamProjecttopicInMain, ({one, many}) => ({
	ongoingTopicsInMains: many(ongoingTopicsInMain),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [c4CaTeamProjecttopicInMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const classesToCoursesInMainRelations = relations(classesToCoursesInMain, ({one}) => ({
	classesInMain: one(classesInMain, {
		fields: [classesToCoursesInMain.classId],
		references: [classesInMain.id]
	}),
	coursesInMain: one(coursesInMain, {
		fields: [classesToCoursesInMain.courseV1],
		references: [coursesInMain.id]
	}),
	exercisesInMain: one(exercisesInMain, {
		fields: [classesToCoursesInMain.exerciseV1],
		references: [exercisesInMain.id]
	}),
	pathwaysV2InMain: one(pathwaysV2InMain, {
		fields: [classesToCoursesInMain.pathwayV2],
		references: [pathwaysV2InMain.id]
	}),
	coursesV2InMain: one(coursesV2InMain, {
		fields: [classesToCoursesInMain.courseV2],
		references: [coursesV2InMain.id]
	}),
	exercisesV2InMain: one(exercisesV2InMain, {
		fields: [classesToCoursesInMain.exerciseV2],
		references: [exercisesV2InMain.id]
	}),
}));

export const courseCompletionV3InMainRelations = relations(courseCompletionV3InMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [courseCompletionV3InMain.userId],
		references: [usersInMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [courseCompletionV3InMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const pathwayCompletionV2InMainRelations = relations(pathwayCompletionV2InMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [pathwayCompletionV2InMain.userId],
		references: [usersInMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [pathwayCompletionV2InMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const c4CaStudentsInMainRelations = relations(c4CaStudentsInMain, ({one}) => ({
	c4CaTeachersInMain: one(c4CaTeachersInMain, {
		fields: [c4CaStudentsInMain.teacherId],
		references: [c4CaTeachersInMain.id]
	}),
}));

export const c4CaTeachersInMainRelations = relations(c4CaTeachersInMain, ({one, many}) => ({
	c4CaStudentsInMains: many(c4CaStudentsInMain),
	c4CaStudentsProjectDetailInMains: many(c4CaStudentsProjectDetailInMain),
	usersInMain: one(usersInMain, {
		fields: [c4CaTeachersInMain.userId],
		references: [usersInMain.id]
	}),
	c4CaPartnersInMain: one(c4CaPartnersInMain, {
		fields: [c4CaTeachersInMain.c4CaPartnerId],
		references: [c4CaPartnersInMain.id]
	}),
	c4CaTeamsInMains: many(c4CaTeamsInMain),
}));

export const assessmentsHistoryInMainRelations = relations(assessmentsHistoryInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [assessmentsHistoryInMain.userId],
		references: [usersInMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [assessmentsHistoryInMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const exerciseCompletionV2InMainRelations = relations(exerciseCompletionV2InMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [exerciseCompletionV2InMain.userId],
		references: [usersInMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [exerciseCompletionV2InMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const c4CaStudentsProjectDetailInMainRelations = relations(c4CaStudentsProjectDetailInMain, ({one}) => ({
	c4CaTeachersInMain: one(c4CaTeachersInMain, {
		fields: [c4CaStudentsProjectDetailInMain.teacherId],
		references: [c4CaTeachersInMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [c4CaStudentsProjectDetailInMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const moduleCompletionV2InMainRelations = relations(moduleCompletionV2InMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [moduleCompletionV2InMain.userId],
		references: [usersInMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [moduleCompletionV2InMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const assessmentResultInMainRelations = relations(assessmentResultInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [assessmentResultInMain.userId],
		references: [usersInMain.id]
	}),
	assessmentInMain: one(assessmentInMain, {
		fields: [assessmentResultInMain.assessmentId],
		references: [assessmentInMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [assessmentResultInMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const learningTrackStatusInMainRelations = relations(learningTrackStatusInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [learningTrackStatusInMain.userId],
		references: [usersInMain.id]
	}),
	exercisesV2InMain: one(exercisesV2InMain, {
		fields: [learningTrackStatusInMain.exerciseId],
		references: [exercisesV2InMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [learningTrackStatusInMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const assessmentOutcomeInMainRelations = relations(assessmentOutcomeInMain, ({one}) => ({
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [assessmentOutcomeInMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
	usersInMain: one(usersInMain, {
		fields: [assessmentOutcomeInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const pathwaysOngoingTopicOutcomeInMainRelations = relations(pathwaysOngoingTopicOutcomeInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [pathwaysOngoingTopicOutcomeInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const learningTrackStatusOutcomeInMainRelations = relations(learningTrackStatusOutcomeInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [learningTrackStatusOutcomeInMain.userId],
		references: [usersInMain.id]
	}),
	c4CaTeamsInMain: one(c4CaTeamsInMain, {
		fields: [learningTrackStatusOutcomeInMain.teamId],
		references: [c4CaTeamsInMain.id]
	}),
}));

export const c4CaRolesInMainRelations = relations(c4CaRolesInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [c4CaRolesInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const zuvyBatchesInMainRelations = relations(zuvyBatchesInMain, ({one}) => ({
	zuvyBootcampsInMain: one(zuvyBootcampsInMain, {
		fields: [zuvyBatchesInMain.bootcampId],
		references: [zuvyBootcampsInMain.id]
	}),
	usersInMain: one(usersInMain, {
		fields: [zuvyBatchesInMain.instructorId],
		references: [usersInMain.id]
	}),
}));

export const zuvyBootcampsInMainRelations = relations(zuvyBootcampsInMain, ({many}) => ({
	zuvyBatchesInMains: many(zuvyBatchesInMain),
	zuvyBootcampTypeInMains: many(zuvyBootcampTypeInMain),
	zuvyModuleTrackingInMains: many(zuvyModuleTrackingInMain),
	zuvyStudentAttendanceInMains: many(zuvyStudentAttendanceInMain),
	zuvySessionsInMains: many(zuvySessionsInMain),
	zuvyRecentBootcampInMains: many(zuvyRecentBootcampInMain),
}));

export const zuvyBootcampTypeInMainRelations = relations(zuvyBootcampTypeInMain, ({one}) => ({
	zuvyBootcampsInMain: one(zuvyBootcampsInMain, {
		fields: [zuvyBootcampTypeInMain.bootcampId],
		references: [zuvyBootcampsInMain.id]
	}),
}));

export const zuvyModuleTrackingInMainRelations = relations(zuvyModuleTrackingInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [zuvyModuleTrackingInMain.userId],
		references: [usersInMain.id]
	}),
	zuvyBootcampsInMain: one(zuvyBootcampsInMain, {
		fields: [zuvyModuleTrackingInMain.bootcampId],
		references: [zuvyBootcampsInMain.id]
	}),
}));

export const subStageInMainRelations = relations(subStageInMain, ({one}) => ({
	schoolStageInMain: one(schoolStageInMain, {
		fields: [subStageInMain.stageId],
		references: [schoolStageInMain.id]
	}),
}));

export const zuvyCodingSubmissionInMainRelations = relations(zuvyCodingSubmissionInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [zuvyCodingSubmissionInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const zuvyStudentAttendanceInMainRelations = relations(zuvyStudentAttendanceInMain, ({one}) => ({
	zuvyBootcampsInMain: one(zuvyBootcampsInMain, {
		fields: [zuvyStudentAttendanceInMain.bootcampId],
		references: [zuvyBootcampsInMain.id]
	}),
}));

export const zuvySessionsInMainRelations = relations(zuvySessionsInMain, ({one}) => ({
	zuvyBootcampsInMain: one(zuvyBootcampsInMain, {
		fields: [zuvySessionsInMain.bootcampId],
		references: [zuvyBootcampsInMain.id]
	}),
}));

export const zuvyChapterTrackingInMainRelations = relations(zuvyChapterTrackingInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [zuvyChapterTrackingInMain.userId],
		references: [usersInMain.id]
	}),
}));

export const zuvyOpenEndedQuestionsInMainRelations = relations(zuvyOpenEndedQuestionsInMain, ({one}) => ({
	zuvyTagsInMain: one(zuvyTagsInMain, {
		fields: [zuvyOpenEndedQuestionsInMain.tagId],
		references: [zuvyTagsInMain.id]
	}),
}));

export const zuvyTagsInMainRelations = relations(zuvyTagsInMain, ({many}) => ({
	zuvyOpenEndedQuestionsInMains: many(zuvyOpenEndedQuestionsInMain),
}));

export const zuvyRecentBootcampInMainRelations = relations(zuvyRecentBootcampInMain, ({one}) => ({
	usersInMain: one(usersInMain, {
		fields: [zuvyRecentBootcampInMain.userId],
		references: [usersInMain.id]
	}),
	zuvyBootcampsInMain: one(zuvyBootcampsInMain, {
		fields: [zuvyRecentBootcampInMain.bootcampId],
		references: [zuvyBootcampsInMain.id]
	}),
}));