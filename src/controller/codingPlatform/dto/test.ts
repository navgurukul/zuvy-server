export async function hardCodeTemplates(language_id) {
    let defTemplates = {
        69: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "IyBQeXRob24gU29sdXRpb24NCmRlZiBsYXJnZXN0X29mX3RocmVlKGEsIGIsIGMpOg0KICAgIHJldHVybiAwDQoNCmlmIF9fbmFtZV9fID09ICJfX21haW5fXyI6DQogICAgYSA9IGludChpbnB1dCgpKQ0KICAgIGIgPSBpbnQoaW5wdXQoKSkgDQogICAgYyA9IGludChpbnB1dCgpKQ0KICAgIHByaW50KGxhcmdlc3Rfb2ZfdGhyZWUoYSwgYiwgYykp"
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPg0KI2luY2x1ZGUgPHZlY3Rvcj4NCiNpbmNsdWRlIDxzc3RyZWFtPg0KDQp1c2luZyBuYW1lc3BhY2Ugc3RkOw0KDQovLyBGdW5jdGlvbiB0byBmaW5kIHRoZSBsYXJnZXN0IG9mIHRocmVlIG51bWJlcnMNCmF1dG8gX2xhcmdlc3Rfb2ZfdGhyZWUoaW50IF9hXywgaW50IF9iXywgaW50IF9jXykgew0KICAgIHJldHVybiAwOw0KfQ0KDQppbnQgbWFpbigpIHsNCiAgICBpbnQgX2FfOw0KICAgIGludCBfYl87DQogICAgaW50IF9jXzsNCiAgICANCiAgICAvLyBJbnB1dCBkYXRhDQogICAgY2luID4+IF9hXzsNCiAgICBjaW4gPj4gX2JfOw0KICAgIGNpbiA+PiBfY187DQoNCiAgICAvLyBDYWxsIGZ1bmN0aW9uIGFuZCBwcmludCByZXN1bHQNCiAgICBhdXRvIHJlc3VsdCA9IF9sYXJnZXN0X29mX3RocmVlKF9hXywgX2JfLCBfY18pOw0KICAgIGNvdXQgPDwgcmVzdWx0IDw8IGVuZGw7DQoNCiAgICByZXR1cm4gMDsNCn0NCg=="
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC5TY2FubmVyOw0KDQpwdWJsaWMgY2xhc3MgTWFpbiB7DQogICAgDQogICAgcHVibGljIHN0YXRpYyBpbnQgbGFyZ2VzdF9vZl90aHJlZShpbnQgX2EsIGludCBfYiwgaW50IF9jKSB7DQogICAgICAgIHJldHVybiAwOw0KICAgIH0NCg0KICAgIHB1YmxpYyBzdGF0aWMgdm9pZCBtYWluKFN0cmluZ1tdIGFyZ3MpIHsNCiAgICAgICAgU2Nhbm5lciBzY2FubmVyID0gbmV3IFNjYW5uZXIoU3lzdGVtLmluKTsNCg0KICAgICAgICBpbnQgX2EgPSBzY2FubmVyLm5leHRJbnQoKTsNCiAgICAgICAgaW50IF9iID0gc2Nhbm5lci5uZXh0SW50KCk7DQogICAgICAgIGludCBfYyA9IHNjYW5uZXIubmV4dEludCgpOw0KDQogICAgICAgIC8vIENhbGwgdGhlIGZ1bmN0aW9uIGFuZCBwcmludCB0aGUgcmVzdWx0DQogICAgICAgIGludCByZXN1bHQgPSBsYXJnZXN0X29mX3RocmVlKF9hLCBfYiwgX2MpOw0KICAgICAgICBTeXN0ZW0ub3V0LnByaW50bG4ocmVzdWx0KTsNCiAgICB9DQp9DQo="
            }
        },
        70: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "ZnJvbSB0eXBpbmcgaW1wb3J0IExpc3QsIERpY3QNCg0KIyBOb3RlOiBQbGVhc2UgcmVtb3ZlIHRoZSBwcmludCBzdGF0ZW1lbnRzIGJlZm9yZSBzdWJtaXR0aW5nIHRoZSBjb2RlLg0KZGVmIGNvdW50X3Zvd2VscyhzOiBzdHIpOg0KICAgICMgQWRkIHlvdXIgY29kZSBoZXJlDQogICAgcmV0dXJuIDANCg0KIyBFeGFtcGxlIHVzYWdlDQpfYSA9IGlucHV0KCkNCnJlc3VsdCA9IGNvdW50X3Zvd2VscyhfYSkNCnByaW50KHJlc3VsdCkNCg=="
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPg0KI2luY2x1ZGUgPHN0cmluZz4NCiNpbmNsdWRlIDxjY3R5cGU+DQoNCnVzaW5nIG5hbWVzcGFjZSBzdGQ7DQoNCi8vIEZ1bmN0aW9uIHRvIGNvdW50IHZvd2VscyBpbiBhIHN0cmluZw0KYXV0byBjb3VudF92b3dlbHMoc3RyaW5nIF9hXykgew0KICAgIHJldHVybiAwOw0KfQ0KDQppbnQgbWFpbigpIHsNCiAgICBzdHJpbmcgX2FfOw0KICAgIA0KICAgIC8vIElucHV0IGRhdGENCiAgICBnZXRsaW5lKGNpbiwgX2FfKTsNCg0KICAgIC8vIENhbGwgZnVuY3Rpb24gYW5kIHByaW50IHJlc3VsdA0KICAgIGF1dG8gcmVzdWx0ID0gY291bnRfdm93ZWxzKF9hXyk7DQogICAgY291dCA8PCByZXN1bHQgPDwgZW5kbDsNCg0KICAgIHJldHVybiAwOw0KfQ0K"
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC5TY2FubmVyOw0KDQpwdWJsaWMgY2xhc3MgTWFpbiB7DQogICAgLy8gQWRkIHlvdXIgY29kZSBoZXJlDQogICAgcHVibGljIHN0YXRpYyBpbnQgY291bnRWb3dlbHMoU3RyaW5nIHMpIHsNCiAgICAgICAgaW50IGNvdW50ID0gMDsNCiAgICAgICAgcmV0dXJuIGNvdW50Ow0KICAgIH0NCg0KICAgIHB1YmxpYyBzdGF0aWMgdm9pZCBtYWluKFN0cmluZ1tdIGFyZ3MpIHsNCiAgICAgICAgLy8gRXhhbXBsZSB1c2FnZQ0KICAgICAgICBTY2FubmVyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcihTeXN0ZW0uaW4pOw0KICAgICAgICBTdHJpbmcgaW5wdXQgPSBzY2FubmVyLm5leHRMaW5lKCk7DQogICAgICAgIGludCByZXN1bHQgPSBjb3VudFZvd2VscyhpbnB1dCk7DQogICAgICAgIFN5c3RlbS5vdXQucHJpbnRsbihyZXN1bHQpOw0KICAgICAgICBzY2FubmVyLmNsb3NlKCk7DQogICAgfQ0KfQ0K"
            }
        },
        57: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "ZGVmIGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGEpOg0KICAgIHJldHVybiAwDQoNCiMgSW5wdXQgZGF0YQ0KaW5wdXRfc3RyID0gaW5wdXQoKS5zdHJpcCgpICAjIFJlYWQgaW5wdXQgYXMgYSBzdHJpbmcNCmEgPSBsaXN0KG1hcChpbnQsIGlucHV0X3N0ci5zcGxpdCgnLCcpKSkgICMgUGFyc2UgaW5wdXQgaW50byBhIGxpc3Qgb2YgaW50ZWdlcnMNCg0KIyBDYWxsIGZ1bmN0aW9uIGFuZCBwcmludCByZXN1bHQNCnJlc3VsdCA9IGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGEpDQpwcmludChyZXN1bHQpDQo="
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "CiAgICAjaW5jbHVkZSA8aW9zdHJlYW0+CiAgICAjaW5jbHVkZSA8dmVjdG9yPgogICAgI2luY2x1ZGUgPHNzdHJlYW0+CiAgICAKICAgIHVzaW5nIG5hbWVzcGFjZSBzdGQ7CiAgICAvLyBOb3RlOiBQbGVhc2UgcmVtb3ZlIHRoZSBjb3V0IHN0YXRlbWVudHMgYmVmb3JlIHN1Ym1pdHRpbmcgdGhlIGNvZGUuCiAgICBhdXRvIGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KHZlY3RvcjxpbnQ+IF9hXykgewogICAgICAvLyBBZGQgeW91ciBjb2RlIGhlcmUKICAgICAgcmV0dXJuIDA7CiAgICB9CiAgICAKICAgIGludCBtYWluKCkgewogICAgICB2ZWN0b3I8aW50PiBfYV87CiAgICAgIC8vIElucHV0IGRhdGEKICAgICAgY2luID4+IF9hXzsKICAgIAogICAgICAvLyBDYWxsIGZ1bmN0aW9uIGFuZCBwcmludCByZXN1bHQKICAgICAgYXV0byByZXN1bHQgPSBsYXJnZXN0X251bWJlcl9pbl9hcnJheShfYV8pOwogICAgICBjb3V0IDw8IHJlc3VsdCA8PCBlbmRsOwogICAgCiAgICAgIHJldHVybiAwOwogICAgfQogICAgICAgICAg"
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOw0KDQpwdWJsaWMgY2xhc3MgTWFpbiB7DQogICAgLy8gRnVuY3Rpb24gdG8gZmluZCB0aGUgbGFyZ2VzdCBudW1iZXIgaW4gYW4gYXJyYXkNCiAgICBwdWJsaWMgc3RhdGljIGludCBsYXJnZXN0X251bWJlcl9pbl9hcnJheShMaXN0PEludGVnZXI+IGEpIHsNCiAgICAgICAgcmV0dXJuIDA7DQogICAgfQ0KDQogICAgcHVibGljIHN0YXRpYyB2b2lkIG1haW4oU3RyaW5nW10gYXJncykgew0KICAgICAgICBTY2FubmVyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcihTeXN0ZW0uaW4pOw0KDQogICAgICAgIC8vIElucHV0IGRhdGENCiAgICAgICAgU3RyaW5nIGlucHV0ID0gc2Nhbm5lci5uZXh0TGluZSgpLnRyaW0oKTsgLy8gUmVhZCBpbnB1dCBhcyBhIHN0cmluZw0KICAgICAgICBTdHJpbmdbXSBlbGVtZW50cyA9IGlucHV0LnNwbGl0KCIsIik7IC8vIFNwbGl0IGJ5IGNvbW1hDQogICAgICAgIExpc3Q8SW50ZWdlcj4gYSA9IG5ldyBBcnJheUxpc3Q8PigpOw0KICAgICAgICBmb3IgKFN0cmluZyBlbGVtZW50IDogZWxlbWVudHMpIHsNCiAgICAgICAgICAgIGEuYWRkKEludGVnZXIucGFyc2VJbnQoZWxlbWVudCkpOyAvLyBDb252ZXJ0IHRvIGludGVnZXJzDQogICAgICAgIH0NCg0KICAgICAgICAvLyBDYWxsIGZ1bmN0aW9uIGFuZCBwcmludCByZXN1bHQNCiAgICAgICAgaW50IHJlc3VsdCA9IGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGEpOw0KICAgICAgICBTeXN0ZW0ub3V0LnByaW50bG4ocmVzdWx0KTsNCg0KICAgICAgICBzY2FubmVyLmNsb3NlKCk7DQogICAgfQ0KfQ0K"
            }
        },
        71: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "ZGVmIGFuYWdyYW0oYSwgYik6DQogICAgcmV0dXJuIFRydWUNCg0KIyBJbnB1dCBkYXRhDQphID0gaW5wdXQoKS5zdHJpcCgpDQpiID0gaW5wdXQoKS5zdHJpcCgpDQoNCiMgQ2FsbCBmdW5jdGlvbiBhbmQgcHJpbnQgcmVzdWx0IGFzIDAgb3IgMQ0KcmVzdWx0ID0gYW5hZ3JhbShhLCBiKQ0KcHJpbnQoMSBpZiByZXN1bHQgZWxzZSAwKQ0K"
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPg0KI2luY2x1ZGUgPHN0cmluZz4NCiNpbmNsdWRlIDxhbGdvcml0aG0+DQoNCnVzaW5nIG5hbWVzcGFjZSBzdGQ7DQoNCi8vIEZ1bmN0aW9uIHRvIGNoZWNrIGlmIHR3byBzdHJpbmdzIGFyZSBhbmFncmFtcw0KYm9vbCBhbmFncmFtKHN0cmluZyBfYV8sIHN0cmluZyBfYl8pIHsNCiAgICANCiAgICByZXR1cm4gMDsNCn0NCg0KaW50IG1haW4oKSB7DQogICAgc3RyaW5nIF9hXywgX2JfOw0KICAgIC8vIElucHV0IGRhdGENCiAgICBnZXRsaW5lKGNpbiwgX2FfKTsNCiAgICBnZXRsaW5lKGNpbiwgX2JfKTsNCg0KICAgIC8vIENhbGwgZnVuY3Rpb24gYW5kIHByaW50IHJlc3VsdA0KICAgIGF1dG8gcmVzdWx0ID0gYW5hZ3JhbShfYV8sIF9iXyk7DQogICAgY291dCA8PCByZXN1bHQgPDwgZW5kbDsNCg0KICAgIHJldHVybiAwOw0KfQ0K"
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOw0KDQpwdWJsaWMgY2xhc3MgTWFpbiB7DQogICAgLy8gRnVuY3Rpb24gdG8gY2hlY2sgaWYgdHdvIHN0cmluZ3MgYXJlIGFuYWdyYW1zDQogICAgcHVibGljIHN0YXRpYyBib29sZWFuIGFuYWdyYW0oU3RyaW5nIGEsIFN0cmluZyBiKSB7DQogICAgICAgIHJldHVybiBmYWxzZTsNCiAgICB9DQoNCiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7DQogICAgICAgIFNjYW5uZXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKFN5c3RlbS5pbik7DQoNCiAgICAgICAgLy8gSW5wdXQgZGF0YQ0KICAgICAgICBTdHJpbmcgYSA9IHNjYW5uZXIubmV4dExpbmUoKS50cmltKCk7DQogICAgICAgIFN0cmluZyBiID0gc2Nhbm5lci5uZXh0TGluZSgpLnRyaW0oKTsNCg0KICAgICAgICAvLyBDYWxsIGZ1bmN0aW9uIGFuZCBwcmludCByZXN1bHQgYXMgMCBvciAxDQogICAgICAgIGJvb2xlYW4gcmVzdWx0ID0gYW5hZ3JhbShhLCBiKTsNCiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKHJlc3VsdCA/IDEgOiAwKTsNCg0KICAgICAgICBzY2FubmVyLmNsb3NlKCk7DQogICAgfQ0KfQ0K"
            }
        },
        72: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "ZGVmIHNlY29uZF9sYXJnZXN0KG51bWJlcnMpOg0KICAgIHJldHVybiAwDQoNCmRlZiBtYWluKCk6DQogICAgIyBJbnB1dCBkYXRhIGFzIGEgY29tbWEtc2VwYXJhdGVkIHN0cmluZw0KICAgIGlucHV0X2RhdGEgPSBpbnB1dCgiIikNCiAgICANCiAgICAjIENvbnZlcnQgaW5wdXQgdG8gYSBsaXN0IG9mIGludGVnZXJzDQogICAgbnVtYmVycyA9IFtpbnQoeC5zdHJpcCgpKSBmb3IgeCBpbiBpbnB1dF9kYXRhLnNwbGl0KCIsIildDQoNCiAgICB0cnk6DQogICAgICAgIHJlc3VsdCA9IHNlY29uZF9sYXJnZXN0KG51bWJlcnMpDQogICAgICAgIHByaW50KHJlc3VsdCkNCiAgICBleGNlcHQgVmFsdWVFcnJvciBhcyBlOg0KICAgICAgICBwcmludChmIkVycm9yOiB7ZX0iKQ0KDQppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOg0KICAgIG1haW4oKQ0K"
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPg0KI2luY2x1ZGUgPHZlY3Rvcj4NCiNpbmNsdWRlIDxzc3RyZWFtPg0KI2luY2x1ZGUgPGxpbWl0cy5oPg0KDQp1c2luZyBuYW1lc3BhY2Ugc3RkOw0KDQovLyBGdW5jdGlvbiB0byBmaW5kIHRoZSBzZWNvbmQgbGFyZ2VzdCBudW1iZXIgaW4gYW4gYXJyYXkNCmludCBzZWNvbmRfbGFyZ2VzdCh2ZWN0b3I8aW50PiBfYV8pIHsNCiAgICANCiAgICByZXR1cm4gMDsNCn0NCg0KaW50IG1haW4oKSB7DQogICAgc3RyaW5nIGlucHV0Ow0KICAgIGNpbiA+PiBpbnB1dDsgLy8gUmVhZCB0aGUgZW50aXJlIGlucHV0IHN0cmluZw0KDQogICAgLy8gUGFyc2UgdGhlIHN0cmluZyB0byBleHRyYWN0IGluZGl2aWR1YWwgaW50ZWdlcnMNCiAgICB2ZWN0b3I8aW50PiBfYV87DQogICAgc3RyaW5nc3RyZWFtIHNzKGlucHV0KTsNCiAgICBzdHJpbmcgZWxlbWVudDsNCg0KICAgIHdoaWxlIChnZXRsaW5lKHNzLCBlbGVtZW50LCAnLCcpKSB7IC8vIEFzc3VtaW5nIGVsZW1lbnRzIGFyZSBjb21tYS1zZXBhcmF0ZWQNCiAgICAgICAgX2FfLnB1c2hfYmFjayhzdG9pKGVsZW1lbnQpKTsNCiAgICB9DQoNCiAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiBhbmQgcHJpbnQgdGhlIHJlc3VsdA0KICAgIGludCByZXN1bHQgPSBzZWNvbmRfbGFyZ2VzdChfYV8pOw0KICAgIGNvdXQgPDwgcmVzdWx0IDw8IGVuZGw7DQoNCiAgICByZXR1cm4gMDsNCn0NCg=="
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOw0KDQpwdWJsaWMgY2xhc3MgTWFpbiB7DQoNCiAgICAvLyBGdW5jdGlvbiB0byBmaW5kIHRoZSBzZWNvbmQgbGFyZ2VzdCBudW1iZXIgaW4gYW4gYXJyYXkNCiAgICBwdWJsaWMgc3RhdGljIGludCBzZWNvbmRMYXJnZXN0KExpc3Q8SW50ZWdlcj4gbnVtYmVycykgew0KICAgICAgICByZXR1cm4gMDsNCiAgICB9DQoNCiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7DQogICAgICAgIFNjYW5uZXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKFN5c3RlbS5pbik7DQogICAgICAgIFN0cmluZyBpbnB1dCA9IHNjYW5uZXIubmV4dExpbmUoKTsgLy8gUmVhZCB0aGUgZW50aXJlIGlucHV0IHN0cmluZw0KDQogICAgICAgIC8vIFBhcnNlIHRoZSBzdHJpbmcgdG8gZXh0cmFjdCBpbmRpdmlkdWFsIGludGVnZXJzDQogICAgICAgIExpc3Q8SW50ZWdlcj4gbnVtYmVycyA9IG5ldyBBcnJheUxpc3Q8PigpOw0KICAgICAgICBTdHJpbmdbXSBlbGVtZW50cyA9IGlucHV0LnNwbGl0KCIsIik7DQoNCiAgICAgICAgZm9yIChTdHJpbmcgZWxlbWVudCA6IGVsZW1lbnRzKSB7DQogICAgICAgICAgICBudW1iZXJzLmFkZChJbnRlZ2VyLnBhcnNlSW50KGVsZW1lbnQudHJpbSgpKSk7DQogICAgICAgIH0NCg0KICAgICAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiBhbmQgcHJpbnQgdGhlIHJlc3VsdA0KICAgICAgICB0cnkgew0KICAgICAgICAgICAgaW50IHJlc3VsdCA9IHNlY29uZExhcmdlc3QobnVtYmVycyk7DQogICAgICAgICAgICBTeXN0ZW0ub3V0LnByaW50bG4ocmVzdWx0KTsNCiAgICAgICAgfSBjYXRjaCAoSWxsZWdhbEFyZ3VtZW50RXhjZXB0aW9uIGUpIHsNCiAgICAgICAgICAgIFN5c3RlbS5vdXQucHJpbnRsbigiRXJyb3I6ICIgKyBlLmdldE1lc3NhZ2UoKSk7DQogICAgICAgIH0NCg0KICAgICAgICBzY2FubmVyLmNsb3NlKCk7DQogICAgfQ0KfQ0K"
            }
        },
        73: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "ZnJvbSB0eXBpbmcgaW1wb3J0IExpc3QNCg0KIyBGdW5jdGlvbiB0byBjaGVjayBpZiBhbiBhcnJheSBpcyBzb3J0ZWQgaW4gYXNjZW5kaW5nIG9yZGVyDQpkZWYgc29ydGVkX2FycmF5KGE6IExpc3RbaW50XSkgLT4gaW50Og0KICAgIHJldHVybiAwDQoNCiMgSW5wdXQgYXMgYSBzcGFjZS1zZXBhcmF0ZWQgc3RyaW5nIGFuZCBjb252ZXJ0IHRvIGEgbGlzdCBvZiBpbnRlZ2Vycw0KX2FfID0gbGlzdChtYXAoaW50LCBpbnB1dCgpLnN0cmlwKCkuc3BsaXQoKSkpDQpyZXN1bHQgPSBzb3J0ZWRfYXJyYXkoX2FfKQ0KcHJpbnQocmVzdWx0KQ0K"
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPg0KI2luY2x1ZGUgPHZlY3Rvcj4NCiNpbmNsdWRlIDxzc3RyZWFtPg0KDQp1c2luZyBuYW1lc3BhY2Ugc3RkOw0KDQovLyBGdW5jdGlvbiB0byBjaGVjayBpZiBhbiBhcnJheSBpcyBzb3J0ZWQgaW4gYXNjZW5kaW5nIG9yZGVyDQpib29sIHNvcnRlZF9hcnJheSh2ZWN0b3I8aW50PiAmYSkgew0KICAgIHJldHVybiB0cnVlOw0KfQ0KDQppbnQgbWFpbigpIHsNCiAgICBzdHJpbmcgaW5wdXQ7DQogICAgZ2V0bGluZShjaW4sIGlucHV0KTsNCiAgICANCiAgICB2ZWN0b3I8aW50PiBhcnI7DQogICAgc3RyaW5nc3RyZWFtIHNzKGlucHV0KTsNCiAgICBpbnQgbnVtOw0KDQogICAgd2hpbGUgKHNzID4+IG51bSkgew0KICAgICAgICBhcnIucHVzaF9iYWNrKG51bSk7DQogICAgfQ0KDQogICAgY291dCA8PCBzb3J0ZWRfYXJyYXkoYXJyKSA8PCBlbmRsOw0KICAgIHJldHVybiAwOw0KfQ0K"
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOw0KDQpwdWJsaWMgY2xhc3MgTWFpbiB7DQogICAgLy8gRnVuY3Rpb24gdG8gY2hlY2sgaWYgYW4gYXJyYXkgaXMgc29ydGVkIGluIGFzY2VuZGluZyBvcmRlcg0KICAgIHB1YmxpYyBzdGF0aWMgaW50IHNvcnRlZF9hcnJheShpbnRbXSBhKSB7DQogICAgICAgIHJldHVybiAwOw0KICAgIH0NCg0KICAgIHB1YmxpYyBzdGF0aWMgdm9pZCBtYWluKFN0cmluZ1tdIGFyZ3MpIHsNCiAgICAgICAgU2Nhbm5lciBzY2FubmVyID0gbmV3IFNjYW5uZXIoU3lzdGVtLmluKTsNCiAgICAgICAgU3RyaW5nIGlucHV0ID0gc2Nhbm5lci5uZXh0TGluZSgpOw0KICAgICAgICANCiAgICAgICAgU3RyaW5nW10gdG9rZW5zID0gaW5wdXQuc3BsaXQoIiAiKTsNCiAgICAgICAgaW50W10gYXJyID0gbmV3IGludFt0b2tlbnMubGVuZ3RoXTsNCg0KICAgICAgICBmb3IgKGludCBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykgew0KICAgICAgICAgICAgYXJyW2ldID0gSW50ZWdlci5wYXJzZUludCh0b2tlbnNbaV0pOw0KICAgICAgICB9DQoNCiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKHNvcnRlZF9hcnJheShhcnIpKTsNCiAgICAgICAgc2Nhbm5lci5jbG9zZSgpOw0KICAgIH0NCn0NCg=="
            }
        },
        74: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "ZnJvbSB0eXBpbmcgaW1wb3J0IExpc3QNCg0KZGVmIGZpYm9uYWNjaV9zZXJpZXMobjogaW50KSAtPiBMaXN0W2ludF06DQogICAgcmV0dXJuIFsyLDNdDQoNCiMgVGFraW5nIGlucHV0IGFzIGEgc3RyaW5nIGFuZCBjb252ZXJ0aW5nIGl0IHRvIGludGVnZXINCmlucHV0X3N0ciA9IGlucHV0KCkuc3RyaXAoKQ0KbiA9IGludChpbnB1dF9zdHIpICAjIENvbnZlcnQgc3RyaW5nIHRvIGludGVnZXINCg0KIyBHZXQgRmlib25hY2NpIHNlcmllcw0KcmVzdWx0ID0gZmlib25hY2NpX3NlcmllcyhuKQ0KcHJpbnQocmVzdWx0KQ0K"
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPg0KI2luY2x1ZGUgPHZlY3Rvcj4NCiNpbmNsdWRlIDxzc3RyZWFtPg0KDQp1c2luZyBuYW1lc3BhY2Ugc3RkOw0KDQp2ZWN0b3I8aW50PiBmaWJvbmFjY2lfc2VyaWVzKGludCBuKSB7DQogICAgcmV0dXJuIDA7DQp9DQoNCmludCBtYWluKCkgew0KICAgIHN0cmluZyBpbnB1dF9zdHI7DQogICAgZ2V0bGluZShjaW4sIGlucHV0X3N0cik7IC8vIFJlYWQgaW5wdXQgYXMgYSBzdHJpbmcNCiAgICBpbnQgbiA9IHN0b2koaW5wdXRfc3RyKTsgLy8gQ29udmVydCBzdHJpbmcgdG8gaW50ZWdlcg0KDQogICAgdmVjdG9yPGludD4gcmVzdWx0ID0gZmlib25hY2NpX3NlcmllcyhuKTsNCiAgICANCiAgICAvLyBQcmludCB0aGUgcmVzdWx0DQogICAgY291dCA8PCAiWyI7DQogICAgZm9yIChzaXplX3QgaSA9IDA7IGkgPCByZXN1bHQuc2l6ZSgpOyBpKyspIHsNCiAgICAgICAgY291dCA8PCByZXN1bHRbaV07DQogICAgICAgIGlmIChpICE9IHJlc3VsdC5zaXplKCkgLSAxKSBjb3V0IDw8ICIsICI7DQogICAgfQ0KICAgIGNvdXQgPDwgIl0iIDw8IGVuZGw7DQoNCiAgICByZXR1cm4gMDsNCn0NCg=="
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOw0KDQpwdWJsaWMgY2xhc3MgTWFpbiB7DQogICAgcHVibGljIHN0YXRpYyBMaXN0PEludGVnZXI+IGZpYm9uYWNjaV9zZXJpZXMoaW50IG4pIHsNCiAgICAgICAgTGlzdDxJbnRlZ2VyPiBzZXJpZXMgPSBuZXcgQXJyYXlMaXN0PD4oKTsNCg0KICAgICAgICByZXR1cm4gc2VyaWVzOw0KICAgIH0NCg0KICAgIHB1YmxpYyBzdGF0aWMgdm9pZCBtYWluKFN0cmluZ1tdIGFyZ3MpIHsNCiAgICAgICAgU2Nhbm5lciBzY2FubmVyID0gbmV3IFNjYW5uZXIoU3lzdGVtLmluKTsNCiAgICAgICAgU3RyaW5nIGlucHV0U3RyID0gc2Nhbm5lci5uZXh0TGluZSgpLnRyaW0oKTsgLy8gUmVhZCBpbnB1dCBhcyBhIHN0cmluZw0KICAgICAgICBpbnQgbiA9IEludGVnZXIucGFyc2VJbnQoaW5wdXRTdHIpOyAvLyBDb252ZXJ0IHN0cmluZyB0byBpbnRlZ2VyDQoNCiAgICAgICAgTGlzdDxJbnRlZ2VyPiByZXN1bHQgPSBmaWJvbmFjY2lfc2VyaWVzKG4pOw0KICAgICAgICBTeXN0ZW0ub3V0LnByaW50bG4ocmVzdWx0KTsgLy8gUHJpbnQgcmVzdWx0IGFzIGEgbGlzdA0KICAgICAgICBzY2FubmVyLmNsb3NlKCk7DQogICAgfQ0KfQ0K"
            }
        },
        75: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "aW1wb3J0IGFzdA0KDQpkZWYgYXJyYXlfYWx0ZXJuYXRlKGFycik6DQogICAgcmVzdWx0ID0gW10NCiAgICByZXR1cm4gcmVzdWx0DQoNCmlmIF9fbmFtZV9fID09ICJfX21haW5fXyI6DQogICAgaW5wdXRfc3RyID0gaW5wdXQoKQ0KICAgIGFyciA9IGFzdC5saXRlcmFsX2V2YWwoaW5wdXRfc3RyKSAgIyBDb252ZXJ0IGlucHV0IHN0cmluZyB0byBsaXN0DQoNCiAgICByZXN1bHQgPSBhcnJheV9hbHRlcm5hdGUoYXJyKQ0KDQogICAgIyBQcmludCByZXN1bHQgaW4gbWFpbg0KICAgIHByaW50KHJlc3VsdCkNCg=="
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPg0KI2luY2x1ZGUgPHZlY3Rvcj4NCiNpbmNsdWRlIDxzc3RyZWFtPg0KDQp1c2luZyBuYW1lc3BhY2Ugc3RkOw0KDQp2ZWN0b3I8aW50PiBhcnJheV9hbHRlcm5hdGUodmVjdG9yPGludD4mIGFycikgew0KICAgICB2ZWN0b3I8aW50PiBhbHRlcm5hdGU7DQogICAgIHJldHVybiBhbHRlcm5hdGU7IC8vIFByb3Blcmx5IHJldHVybmluZyB0aGUgYXJyYXkNCg0KfQ0KDQppbnQgbWFpbigpIHsNCiAgICBzdHJpbmcgaW5wdXQ7DQogICAgZ2V0bGluZShjaW4sIGlucHV0KTsNCg0KICAgIHZlY3RvcjxpbnQ+IGFycjsNCiAgICBzdHJpbmdzdHJlYW0gc3MoaW5wdXQpOw0KICAgIGNoYXIgY2g7DQogICAgaW50IG51bTsNCg0KICAgIHdoaWxlIChzcyA+PiBjaCkgew0KICAgICAgICBpZiAoaXNkaWdpdChjaCkgfHwgY2ggPT0gJy0nKSB7DQogICAgICAgICAgICBzcy5wdXRiYWNrKGNoKTsNCiAgICAgICAgICAgIHNzID4+IG51bTsNCiAgICAgICAgICAgIGFyci5wdXNoX2JhY2sobnVtKTsNCiAgICAgICAgfQ0KICAgIH0NCg0KICAgIHZlY3RvcjxpbnQ+IHJlc3VsdCA9IGFycmF5X2FsdGVybmF0ZShhcnIpOw0KICAgIA0KICAgIC8vIFByaW50IHJlc3VsdCBpbiBtYWluDQogICAgY291dCA8PCAiWyI7DQogICAgZm9yIChzaXplX3QgaSA9IDA7IGkgPCByZXN1bHQuc2l6ZSgpOyBpKyspIHsNCiAgICAgICAgY291dCA8PCByZXN1bHRbaV07DQogICAgICAgIGlmIChpICE9IHJlc3VsdC5zaXplKCkgLSAxKSBjb3V0IDw8ICIsICI7DQogICAgfQ0KICAgIGNvdXQgPDwgIl0iIDw8IGVuZGw7DQoNCiAgICByZXR1cm4gMDsNCn0NCg=="
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOw0KDQpwdWJsaWMgY2xhc3MgTWFpbiB7DQogICAgcHVibGljIHN0YXRpYyBMaXN0PEludGVnZXI+IGFycmF5QWx0ZXJuYXRlKExpc3Q8SW50ZWdlcj4gYXJyKSB7DQogICAgICAgIExpc3Q8SW50ZWdlcj4gcmVzdWx0ID0gbmV3IEFycmF5TGlzdDw+KCk7DQogICAgICAgIHJldHVybiByZXN1bHQ7DQogICAgfQ0KDQogICAgcHVibGljIHN0YXRpYyB2b2lkIG1haW4oU3RyaW5nW10gYXJncykgew0KICAgICAgICBTY2FubmVyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcihTeXN0ZW0uaW4pOw0KICAgICAgICBTdHJpbmcgaW5wdXQgPSBzY2FubmVyLm5leHRMaW5lKCkucmVwbGFjZUFsbCgiW1xcW1xcXV0iLCAiIik7DQogICAgICAgIHNjYW5uZXIuY2xvc2UoKTsNCg0KICAgICAgICBMaXN0PEludGVnZXI+IGFyciA9IG5ldyBBcnJheUxpc3Q8PigpOw0KICAgICAgICBmb3IgKFN0cmluZyBudW0gOiBpbnB1dC5zcGxpdCgiLCIpKSB7DQogICAgICAgICAgICBhcnIuYWRkKEludGVnZXIucGFyc2VJbnQobnVtLnRyaW0oKSkpOw0KICAgICAgICB9DQoNCiAgICAgICAgTGlzdDxJbnRlZ2VyPiByZXN1bHQgPSBhcnJheUFsdGVybmF0ZShhcnIpOw0KDQogICAgICAgIC8vIFByaW50IHJlc3VsdCBpbiBtYWluDQogICAgICAgIFN5c3RlbS5vdXQucHJpbnRsbihyZXN1bHQpOw0KICAgIH0NCn0NCg=="
            }
        },
        76: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "aW1wb3J0IHN5cw0KDQpkZWYgbWlzc2luZ19wb3NpdGl2ZV9pbnRlZ2VyKGFycik6DQogICAgcmV0dXJuIDENCg0KaWYgX19uYW1lX18gPT0gIl9fbWFpbl9fIjoNCiAgICBpbnB1dF9zdHIgPSBzeXMuc3RkaW4ucmVhZCgpLnN0cmlwKCkNCiAgICANCiAgICAjIENvbnZlcnQgaW5wdXQgc3RyaW5nIHRvIGEgbGlzdCBvZiBpbnRlZ2Vycw0KICAgIGlucHV0X3N0ciA9IGlucHV0X3N0ci5yZXBsYWNlKCJbIiwgIiIpLnJlcGxhY2UoIl0iLCAiIikNCiAgICBhcnIgPSBsaXN0KG1hcChpbnQsIGlucHV0X3N0ci5zcGxpdCgiLCIpKSkNCg0KICAgIHJlc3VsdCA9IG1pc3NpbmdfcG9zaXRpdmVfaW50ZWdlcihhcnIpDQogICAgcHJpbnQocmVzdWx0KQ0K"
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPg0KI2luY2x1ZGUgPHZlY3Rvcj4NCiNpbmNsdWRlIDxzc3RyZWFtPg0KDQp1c2luZyBuYW1lc3BhY2Ugc3RkOw0KDQppbnQgbWlzc2luZ19wb3NpdGl2ZV9pbnRlZ2VyKHZlY3RvcjxpbnQ+JiBhcnIpIHsgIA0KICAgIHJldHVybiAxOw0KfQ0KDQppbnQgbWFpbigpIHsNCiAgICBzdHJpbmcgaW5wdXQ7DQogICAgZ2V0bGluZShjaW4sIGlucHV0KTsNCg0KICAgIHZlY3RvcjxpbnQ+IGFycjsNCiAgICBzdHJpbmdzdHJlYW0gc3MoaW5wdXQpOw0KICAgIGNoYXIgY2g7DQogICAgaW50IG51bTsNCg0KICAgIHdoaWxlIChzcyA+PiBjaCkgew0KICAgICAgICBpZiAoaXNkaWdpdChjaCkgfHwgY2ggPT0gJy0nKSB7DQogICAgICAgICAgICBzcy5wdXRiYWNrKGNoKTsNCiAgICAgICAgICAgIHNzID4+IG51bTsNCiAgICAgICAgICAgIGFyci5wdXNoX2JhY2sobnVtKTsNCiAgICAgICAgfQ0KICAgIH0NCg0KICAgIGludCByZXN1bHQgPSBtaXNzaW5nX3Bvc2l0aXZlX2ludGVnZXIoYXJyKTsNCiAgICBjb3V0IDw8IHJlc3VsdCA8PCBlbmRsOw0KDQogICAgcmV0dXJuIDA7DQp9DQo="
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOw0KDQpwdWJsaWMgY2xhc3MgTWFpbiB7DQogICAgcHVibGljIHN0YXRpYyBpbnQgbWlzc2luZ1Bvc2l0aXZlSW50ZWdlcihpbnRbXSBhcnIpIHsNCiAgICAgICAgDQogICAgICAgIHJldHVybiAxOw0KICAgIH0NCg0KICAgIHB1YmxpYyBzdGF0aWMgdm9pZCBtYWluKFN0cmluZ1tdIGFyZ3MpIHsNCiAgICAgICAgU2Nhbm5lciBzY2FubmVyID0gbmV3IFNjYW5uZXIoU3lzdGVtLmluKTsNCiAgICAgICAgU3RyaW5nIGlucHV0ID0gc2Nhbm5lci5uZXh0TGluZSgpLnJlcGxhY2VBbGwoIltcXFtcXF1dIiwgIiIpOw0KICAgICAgICBzY2FubmVyLmNsb3NlKCk7DQoNCiAgICAgICAgTGlzdDxJbnRlZ2VyPiBhcnJMaXN0ID0gbmV3IEFycmF5TGlzdDw+KCk7DQogICAgICAgIGZvciAoU3RyaW5nIG51bSA6IGlucHV0LnNwbGl0KCIsIikpIHsNCiAgICAgICAgICAgIGFyckxpc3QuYWRkKEludGVnZXIucGFyc2VJbnQobnVtLnRyaW0oKSkpOw0KICAgICAgICB9DQoNCiAgICAgICAgaW50W10gYXJyID0gYXJyTGlzdC5zdHJlYW0oKS5tYXBUb0ludChpIC0+IGkpLnRvQXJyYXkoKTsNCiAgICAgICAgaW50IHJlc3VsdCA9IG1pc3NpbmdQb3NpdGl2ZUludGVnZXIoYXJyKTsNCiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKHJlc3VsdCk7DQogICAgfQ0KfQ0K"
            }
        },
    }
    return defTemplates[language_id];
}
