export let bootcampsEditEntry = {
    schema: {
    type: 'object',
    properties: {
        coverImage: {
            type: 'string',
            example: 'The bootcamp cover image',
        },
        name: {
            type: 'string',
            example: 'The bootcamp name',
        },
        bootcampTopic: {
            type: 'string',
            example: 'The bootcamp topic',
        },
        instractorId: {
            type: 'number',
            example: 20230,
        },
        schedules: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    startTime: {
                        type: 'string',
                        example: 'The schedule start time',
                    },
                    endTime: {
                        type: 'string',
                        example: 'The schedule end time',
                    },
                    day: {
                        type: 'string',
                        example: 'The schedule day',
                    },
                },
            },
        },
        language: {
            type: 'string',
            example: 'The bootcamp language',
        },
        capEnrollment: {
            type: 'number',
            example: 500,
        },
    },
    }
}

export let bootcampsEntry = {
    schema: {
    type: 'object',
    properties: {
        name: {
            type: 'string',
            example: 'The bootcamp name',
            },
        },
    }
}