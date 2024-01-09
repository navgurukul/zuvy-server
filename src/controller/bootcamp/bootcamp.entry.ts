export let bootcampsEntry = {
    schema: {
    type: 'object',
    properties: {
        cover_image: {
            type: 'url',
            example: 'The bootcamp cover image',
        },
        name: {
            type: 'string',
            example: 'The bootcamp name',
        },
        bootcamp_topic: {
            type: 'string',
            example: 'The bootcamp topic',
        },
        instractor_id: {
            type: 'number',
            example: 0,
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
        cap_enrollment: {
            type: 'number',
            example: 0,
        },
    },
    }
}