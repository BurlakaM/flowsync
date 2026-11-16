import {IsNumber, IsString} from "class-validator";

// The author is taken from the access token, not from the request body.
export class TasksDto {
    @IsString()
    name: string;

    @IsString()
    description: string;

    @IsNumber()
    project_id: number;
}

export type TasksUpdateDto = Partial<TasksDto>
