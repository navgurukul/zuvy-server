import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsNumber,
  isArray,
  IsEmail,
  IsObject,
  ArrayNotEmpty,
  isString,
  IsArray,
  isNumber,
  IsJSON,
  isObject,
  IsBoolean,
  IsDefined,
} from 'class-validator';
import { truncateSync } from 'fs';
import { Type } from 'class-transformer';
import { difficulty, questionType } from 'drizzle/schema';

export class moduleDto {
  @ApiProperty({
    type: String,
    example: 'Introduction to Python',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    example: 'Python is a programming language',
  })
  @IsString()
  description: string;

  @ApiProperty({
    type: Number,
    example: 120900,
  })
  @IsNumber()
  timeAlloted: number;

  @ApiProperty({
    type: Boolean,
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isLock: boolean;
}

export class projectDto {
  @ApiProperty({
    type: String,
    example: 'Project on advance Python',
  })
  @IsOptional()
  @IsString()
  title: string;

  @ApiProperty({
    type: Object,
    example : {
      "description" : "This project is based on the 3 months bootcamps that you have been taught"
    }
  })
  @IsOptional()
  @IsObject()
  instruction: object;

  @ApiProperty({
    type: Boolean,
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isLock: boolean;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z'
  })
  @IsString()
  @IsOptional()
  deadline: string;

}

export class chapterDto {
  @ApiProperty({
    type: String,
    example: 'Any thing like article or video or quiz',
    required: true,
  })
  @IsString()
  title: string;

  @ApiProperty({
    type: String,
    example: 'Any description to the chapter',
  })
  @IsString()
  description: string;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z'
  })
  @IsString()
  @IsOptional()
  completionDate: string;

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  quizQuestions: number[];

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  formQuestions: number[];
  
  @ApiProperty({
    type: [String],
    example: ['https://www.google.com'],
  })
  @IsArray()
  @IsOptional()
  links: string[];

  @ApiProperty({
    type : [Object],
    example: [
      {
          "blocks": [
              {
                  "key": "fbh77",
                  "text": "asdfasddfasdf",
                  "type": "unstyled",
                  "depth": 0,
                  "inlineStyleRanges": [],
                  "entityRanges": [],
                  "data": {}
              }
          ],
          "entityMap": {}
      }
  ]
  })
  @IsArray()
  @IsOptional()

  content: [object];


}

export class quizDto {
  @ApiProperty({
    type: String,
    example: 'What is the national animal of India',
    required: true,
  })
  @IsString()
  question: string;

  @ApiProperty({
    type: 'object',
    example: {
      1: 'Option 1',
      2: 'Option 2',
      3: 'Option 3',
      4: 'Option 4',
    },
    required: true,
  })
  @IsObject()
  options: object;

  @ApiProperty({
    type: Number,
    example: 2,
    required: true,
  })
  @IsNumber()
  correctOption: number;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  mark: number;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  tagId: number;

  @ApiProperty({
    type: difficulty,
    example: 'Easy',
    required: true,
  })
  @IsString()
  @IsOptional()
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export class  quizBatchDto {
  @ApiProperty({
    type: [quizDto],
    example: [
      {
        question: 'What is the national animal of India?',
        options: {
          1: 'Option 1',
          2: 'Option 2',
          3: 'Option 3',
          4: 'Option 4',
        },
        correctOption: 2,
        mark: 1,
        tagId: 2,
        difficulty: 'Easy',
      },
      {
        question: 'What is the capital of France?',
        options: {
          1: 'Paris',
          2: 'London',
          3: 'Berlin',
          4: 'Rome',
        },
        correctOption: 3,
        mark: 1,
        tagId: 2,
        difficulty: 'Easy',
      },
    ],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => quizDto)
  questions: quizDto[];

}

export class reOrderDto {
  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  newOrder: number;
}

export class ReOrderModuleBody {
  @ApiProperty({ type: moduleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => moduleDto)
  moduleDto: moduleDto;

  @ApiProperty({ type: reOrderDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => reOrderDto)
  reOrderDto: reOrderDto;
}

export class EditChapterDto {
  @ApiProperty({
    type: String,
    example: 'Any thing like article or video or quiz',
  })
  @IsString()
  @IsOptional()
  title: string;

  @ApiProperty({
    type: String,
    example: 'Any description to the chapter',
  })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z',
  })
  @IsString()
  @IsOptional()
  completionDate: string;

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  quizQuestions: any[];

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  formQuestions: any[];
  
  @ApiProperty({
    type: Number,
    example: 10,
  })
  @IsNumber()
  @IsOptional()
  codingQuestions: number;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  newOrder: number;

  @ApiProperty({
    type: [String],
    example: ['https://www.google.com'],
  })
  @IsArray()
  @IsOptional()
  links: string[];

  @ApiProperty({
    type : [Object],
    example: [
      {
          "blocks": [
              {
                  "key": "fbh77",
                  "text": "asdfasddfasdf",
                  "type": "unstyled",
                  "depth": 0,
                  "inlineStyleRanges": [],
                  "entityRanges": [],
                  "data": {}
              }
          ],
          "entityMap": {}
      }
  ]
  })
  @IsArray()
  @IsOptional()

  articleContent: [object];
}

export class openEndedDto {
  @ApiProperty({
    type: String,
    example: 'What is the national animal of India',
    required: true,
  })
  @IsString()
  question: string;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  marks: number;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  tagId: number;

  @ApiProperty({
    type: difficulty,
    example: 'Easy',
    required: true,
  })
  @IsString()
  @IsOptional()
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export class UpdateOpenEndedDto {
  @ApiProperty({
    type: String,
    example: 'What is the national animal of India'
  })
  @IsOptional()
  @IsString()
  question: string;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  tagId: number;

  @ApiProperty({
    type: difficulty,
    example: 'Easy'
  })
  @IsString()
  @IsOptional()
  difficulty: 'Easy' | 'Medium' | 'Hard';
}
export class CreateAssessmentBody {
  @ApiProperty({
    type: String,
    example: 'Assessment:Intro to Python',
  })
  @IsString()
  @IsOptional()
  title: string;

  @ApiProperty({
    type: String,
    example: 'This assessment has 2 dsa problems,5 mcq and 3 theory questions',
  })
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty({
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @IsOptional()
  codingProblemIds: number[];

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  mcqIds: number[];

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  openEndedQuestionIds: number[];

  @ApiProperty({
    type: Number,
    example: 70
  })
  @IsNumber()
  @IsDefined()
  passPercentage: number;

  @ApiProperty({
    type: Number,
    example: 7200
  })
  @IsNumber()
  @IsDefined()
  timeLimit: number;

  @ApiProperty({
    type: Boolean,
    example: true
  })
  @IsOptional()
  @IsBoolean()
  copyPaste: boolean;

  @ApiProperty({
    type: Boolean,
    example: true
  })
  @IsOptional()
  @IsBoolean()
  embeddedGoogleSearch: boolean;

  @ApiProperty({
    type: Boolean,
    example: false
  })
  @IsOptional()
  @IsBoolean()
  tabChange: boolean;

  @ApiProperty({
    type: Boolean,
    example: true
  })
  @IsOptional()
  @IsBoolean()
  screenRecord: boolean;

  @ApiProperty({
    type: Boolean,
    example: true
  })
  @IsOptional()
  @IsBoolean()
  webCamera: boolean;

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  codingQuestionTagId: number[];

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  mcqTagId: number[];

  @ApiProperty({
    type: Number,
    example: 3,
  })
  @IsNumber()
  @IsOptional()
  easyCodingQuestions: number;

  @ApiProperty({
    type: Number,
    example: 4,
  })
  @IsNumber()
  @IsOptional()
  mediumCodingQuestions: number;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  hardCodingQuestions: number;

  @ApiProperty({
    type: Number,
    example: 9,
  })
  @IsNumber()
  @IsOptional()
  totalCodingQuestions: number;

  @ApiProperty({
    type: Number,
    example: 5,
  })
  @IsNumber()
  @IsOptional()
  totalMcqQuestions: number;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  easyMcqQuestions: number;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  mediumMcqQuestions: number;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  hardMcqQuestions: number;

  @ApiProperty({
    type: Number,
    example: 40,
  })
  @IsNumber()
  @IsOptional()
  weightageCodingQuestions: number;

  @ApiProperty({
    type: Number,
    example: 60,
  })
  @IsNumber()
  @IsOptional()
  weightageMcqQuestions: number;
}

export class editQuizDto {
  
  @ApiProperty({
    type: Number,
    example: 1,
    required: true
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    type: String,
    example: 'What is the national animal of India',
  })
  @IsString()
  @IsOptional()
  question: string;

  @ApiProperty({
    type: 'object',
    example: {
      1: 'Option 1',
      2: 'Option 2',
      3: 'Option 3',
      4: 'Option 4',
    }
  })
  @IsObject()
  @IsOptional()
  options: object;

  @ApiProperty({
    type: Number,
    example: 2
  })
  @IsNumber()
  @IsOptional()
  correctOption: number;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  marks: number;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  tagId: number;

  @ApiProperty({
    type: difficulty,
    example: 'Easy'
  })
  @IsString()
  @IsOptional()
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export class editQuizBatchDto {
  @ApiProperty({
    type: [editQuizDto],
    example: [
      {
        id: 1,
        question: 'What is the national animal of India?',
        options: {
          1: 'Option 1',
          2: 'Option 2',
          3: 'Option 3',
          4: 'Option 4',
        },
        correctOption: 2,
        marks: 1,
        tagId: 2,
        difficulty: 'Easy',
      },
      {
        question: 'What is the capital of France?',
        options: {
          1: 'Paris',
          2: 'London',
          3: 'Berlin',
          4: 'Rome',
        },
        correctOption: 3,
        marks: 1,
        tagId: 2,
        difficulty: 'Easy',
      },
    ],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => editQuizDto)
  questions: editQuizDto[];
}

export class testCaseDto {
  @ApiProperty({
    type: 'object',
    example: {
      input: [2, 3],
      output: [5],
    },
    required: true,
  })
  @IsObject()
  inputs: object;
}

export class UpdateProblemDto {
  @ApiProperty({
    type: String,
    example: 'Add two numbers'
  })
  @IsOptional()
  @IsString()
  title: string;

  @ApiProperty({
    type: String,
    example: 'Write a program to add two float values'
  })
  @IsOptional()
  @IsString()
  description: string;

  @ApiProperty({
    type: difficulty,
    example: 'Easy',
  })
  @IsOptional()
  @IsString()
  difficulty: 'Easy' | 'Medium' | 'Hard';

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  tags: number;

  @ApiProperty({
    type: String,
    example: ' 10 <number < 1000'
  })
  @IsOptional()
  @IsString()
  constraints: string;

  @ApiProperty({
    type: Number,
    example: 45499,
  })
  @IsOptional()
  @IsNumber()
  authorId: number;

  @ApiProperty({
    type: [testCaseDto],
    example: [
      {
        inputs: {
          input: [2, 3],
          output: [5],
        },
      },
    ]
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => testCaseDto)
  examples: testCaseDto[];

  @ApiProperty({
    type: [testCaseDto],
    example: [
      {
        inputs: {
          input: [2, 3],
          output: [5],
        },
      },
      {
        inputs: {
          input: [5, 6],
          output: [11],
        },
      },
    ]
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => testCaseDto)
  testCases: testCaseDto[];

  @ApiProperty({
    type: [Number, String],
    examples: [5, 'hello', 11],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  expectedOutput: any[];

  @ApiProperty({
    type: String,
    example: 'solution of the coding question'
  })
  @IsOptional()
  @IsString()
  solution: string;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z'
  })
  @IsString()
  @IsOptional()
  createdAt: string;

  @ApiProperty({
    type: String,
    example: '2023-03-01T00:00:00Z'
  })
  @IsString()
  @IsOptional()
  updatedAt: string;

}

export class deleteQuestionDto{
  @ApiProperty({
    type: [Number],
    examples: [1,2,3],
    required: true
  })
  @IsArray()
  @ArrayNotEmpty()
  questionIds: any[];
}

export class CreateTagDto{
  @ApiProperty({
    type: String,
    example : 'Linked List',
    required: true
  })

  @IsString()
  @IsNotEmpty()
  tagName : string
}

export class CreateChapterDto {
  @ApiProperty({
    type: Number,
    example: 9,
  })
  @IsOptional()
  @IsNumber()
  moduleId: number;

  @ApiProperty({
    type: Number,
    example: 9,
  })
  @IsOptional()
  @IsNumber()
  bootcampId: number;

  @ApiProperty({
    type: Number,
    example: 4,
  })
  @IsOptional()
  @IsNumber()
  topicId: number;
}

export class CreateTypeDto{
  @ApiProperty({
    type: String,
    example : 'Multiple Choice',
    required: true
  })

  @IsString()
  @IsNotEmpty()
  questionType : string
}

export class formDto {
  @ApiProperty({
    type: String,
    example: 'What is your opinion about the course?',
  })
  @IsString()
  @IsOptional()
  question: string;

  @ApiProperty({
    type: 'object',
    example: {
      1: 'Option 1',
      2: 'Option 2',
      3: 'Option 3',
      4: 'Option 4',
    }
  })
  @IsObject()
  @IsOptional() 
  options: object;

  @ApiProperty({
    type: Number,
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  typeId: number;

  @ApiProperty({
    type: Boolean,
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isRequired: boolean;

}

export class formBatchDto {
  @ApiProperty({
    type: [formDto],
    example: [
      {
        // chapterId:34,
        question: 'What do you like about the course?',
        options: {
          1: 'Option 1',
          2: 'Option 2',
          3: 'Option 3',
          4: 'Option 4',
        },
        typeId: 1,
        isRequired:false,
      },
      {
        // chapterId:34,
        question: 'What do you want to improve about the course?',
        options: {
          1: 'Paris',
          2: 'London',
          3: 'Berlin',
          4: 'Rome',
        },
        typeId: 2,
        isRequired:false,
      },
      {
        // chapterId:34,
        question: 'What is your opinion about the course?',
        typeId: 3,
        isRequired:false,
      },
      {
        // chapterId:34,
        question: 'Choose date of opting the course',
        typeId: 4,
        isRequired:false,
      },
      {
        // chapterId:34,
        question: 'Choose time of opting the course',
        typeId: 5,
        isRequired:false,
      },
    ],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => formDto)
  questions: formDto[];
}

export class editFormDto {

  @ApiProperty({
    type: Number,
    example: 1,
    required: true
  })
  @IsNumber()
  id: number;
  
  @ApiProperty({
    type: String,
    example: 'What is your opinion about the course?',
  })
  @IsString()
  @IsOptional()
  question: string;

  @ApiProperty({
    type: 'object',
    example: {
      1: 'Option 1',
      2: 'Option 2',
      3: 'Option 3',
      4: 'Option 4',
    }
  })
  @IsObject()
  @IsOptional()
  options: object;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  typeId: number;

  @ApiProperty({
    type: Boolean,
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isRequired: boolean;
}

export class editFormBatchDto {
  @ApiProperty({
    type: [editFormDto],
    example: [
      {
        id: 1,
        // chapterId:34,
        question: 'What is the national animal of India?',
        options: {
          1: 'Option 1',
          2: 'Option 2',
          3: 'Option 3',
          4: 'Option 4',
        },
        typeId: 1,
        isRequired:false,
      },
      {
        id: 2,
        // chapterId:34,
        question: 'What is the capital of France?',
        options: {
          1: 'Paris',
          2: 'London',
          3: 'Berlin',
          4: 'Rome',
        },
        typeId: 2,
        isRequired:false,
      },
      {
        id: 3,
        // chapterId:34,
        question: 'What is the national animal of India?',
        typeId: 3,
        isRequired:false,
      },
      {
        id: 4,
        // chapterId:34,
        question: 'Choose date of opting the course',
        typeId: 4,
        isRequired:false,
      },
      {
        id: 5,
        // chapterId:34,
        question: 'Choose time of opting the course',
        typeId: 5,
        isRequired:false,
      },
    ],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => editFormDto)
  questions: editFormDto[];

}

export class CreateAndEditFormBody {
  @ApiProperty({ type: formBatchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => formBatchDto)
  formQuestionDto: formBatchDto;

  @ApiProperty({ type: editFormBatchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => editFormBatchDto)
  editFormQuestionDto: editFormBatchDto;
  //questions: any;
}
