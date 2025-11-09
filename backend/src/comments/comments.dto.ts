import {IsNumber, IsString} from "class-validator";

export class CommentsDto {
    @IsString()
    text: string;

    @IsNumber()
    user_id: number;

    @IsNumber()
    task_id: number;

}

export type CommentsUpdateDto = Partial<CommentsDto>