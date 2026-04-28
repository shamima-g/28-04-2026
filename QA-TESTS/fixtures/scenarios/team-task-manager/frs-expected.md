# Feature: Team Task Manager

## Problem Statement
Small teams need a lightweight shared task list where admins can assign work and members can see and complete only what belongs to them.

## User Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| Admin | Team lead | Create, assign, edit, delete tasks; view all tasks |
| Member | Team member | View own assigned tasks; mark own tasks complete |

## Functional Requirements

- **R1:** Admins can view all tasks in the system
- **R2:** Members can view only tasks assigned to them
- **R3:** Admins can create a task (title and assignee required; description and due date optional)
- **R4:** Admins can edit a task's due date
- **R5:** Admins can delete a task with confirmation
- **R6:** Any user can mark their own task complete (pending ↔ complete)

## Business Rules

- **BR1:** Only admins see the Create, Delete, and Edit controls
- **BR2:** Members see an empty-state message when no tasks are assigned
- **BR3:** Delete requires an explicit confirmation dialog

## Source Traceability

| ID  | Source | Reference |
|-----|--------|-----------|
| R1   | User input | Elevator pitch + Q1 roles |
| R2   | User input | Q1 roles |
| R3   | User input | Elevator pitch |
| R4   | User input | Elevator pitch |
| R5   | User input | Elevator pitch + FRS clarifying Q |
| R6   | User input | Elevator pitch |
| BR1  | User input | Derived from R1–R5 |
| BR2  | User input | FRS clarifying Q |
| BR3  | User input | FRS clarifying Q |
