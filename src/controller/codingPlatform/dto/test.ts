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
            },
            "c": {
                id: 104,
                name: "C",
                template: "I2luY2x1ZGUgPHN0ZGlvLmg+CgovLyBGdW5jdGlvbiB0byBmaW5kIHRoZSBsYXJnZXN0IG9mIHRocmVlIG51bWJlcnMKaW50IGxhcmdlc3Rfb2ZfdGhyZWUoaW50IGEsIGludCBiLCBpbnQgYykgewogICAgLy93cml0ZSB5b3VyIGNvZGUgaGVyZQoKICAgIAp9CgppbnQgbWFpbigpIHsKICAgIGludCBhLCBiLCBjOwogICAgCiAgICAvLyBSZWFkIHRocmVlIG51bWJlcnMgYXMgaW5wdXQKICAgIHNjYW5mKCIlZCAlZCAlZCIsICZhLCAmYiwgJmMpOwogICAgCiAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB0byBnZXQgdGhlIGxhcmdlc3QgbnVtYmVyIGFuZCBwcmludCB0aGUgcmVzdWx0CiAgICBwcmludGYoIiVkXG4iLCBsYXJnZXN0X29mX3RocmVlKGEsIGIsIGMpKTsKICAgIAogICAgcmV0dXJuIDA7Cn0K"
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
            },
            "c": {
                id: 104,
                name: "C",
                template: "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxjdHlwZS5oPiAgLy8gRm9yIHRoZSB0b2xvd2VyIGZ1bmN0aW9uCgppbnQgY291bnRWb3dlbHMoY2hhciBzdHJbXSkgewogICAgLy93cml0ZSB5b3VyIGNvZGUgaGVyZQogICAgcmV0dXJuIDA7Cgp9CgppbnQgbWFpbigpIHsKICAgIGNoYXIgc3RyWzEwMF07CgogICAgZmdldHMoc3RyLCBzaXplb2Yoc3RyKSwgc3RkaW4pOwoKICAgIGlmIChzdHJbc3RybGVuKHN0cikgLSAxXSA9PSAnXG4nKSB7CiAgICAgICAgc3RyW3N0cmxlbihzdHIpIC0gMV0gPSAnXDAnOwogICAgfQoKICAgIGludCB2b3dlbHMgPSBjb3VudFZvd2VscyhzdHIpOwoKICAgIHByaW50ZigiJWRcbiIsIHZvd2Vscyk7CgogICAgcmV0dXJuIDA7Cn0K"
            }
        },
        57: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "ZGVmIGZpbmRfbGFyZ2VzdF9udW1iZXIoYXJyKToKICAgICN3cml0ZSB5b3VyIGNvZGUgaGVyZQogICAgcmV0dXJuIDAKCmlmIF9fbmFtZV9fID09ICJfX21haW5fXyI6CiAgICBpbnB1dF9zdHIgPSBpbnB1dCgpLnN0cmlwKCkgCiAgICBhcnIgPSBbaW50KHguc3RyaXAoKSkgZm9yIHggaW4gaW5wdXRfc3RyLnNwbGl0KCcsJyldIAogICAgcHJpbnQoZmluZF9sYXJnZXN0X251bWJlcihhcnIpKSAK"
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8c3N0cmVhbT4KI2luY2x1ZGUgPHZlY3Rvcj4KI2luY2x1ZGUgPHN0cmluZz4KI2luY2x1ZGUgPGFsZ29yaXRobT4KCnVzaW5nIG5hbWVzcGFjZSBzdGQ7CgovLyBGdW5jdGlvbiB0byBmaW5kIHRoZSBsYXJnZXN0IG51bWJlciBpbiB0aGUgYXJyYXkKaW50IGZpbmRMYXJnZXN0TnVtYmVyKGNvbnN0IHZlY3RvcjxpbnQ+JiBhcnIpIHsKICAgIC8vd3JpdGUgeW91ciBjb2RlIGhlcmUKICAgIHJldHVybiAwOwp9CgppbnQgbWFpbigpIHsKICAgIHN0cmluZyBpbnB1dDsKICAgIGdldGxpbmUoY2luLCBpbnB1dCk7CgogICAgaWYgKGlucHV0LmZyb250KCkgPT0gJ1snKSBpbnB1dCA9IGlucHV0LnN1YnN0cigxKTsKICAgIGlmIChpbnB1dC5iYWNrKCkgPT0gJ10nKSBpbnB1dCA9IGlucHV0LnN1YnN0cigwLCBpbnB1dC5zaXplKCkgLSAxKTsKCiAgICBzdHJpbmdzdHJlYW0gc3MoaW5wdXQpOwogICAgc3RyaW5nIHRlbXA7CiAgICB2ZWN0b3I8aW50PiBhcnI7CgogICAgCiAgICB3aGlsZSAoZ2V0bGluZShzcywgdGVtcCwgJywnKSkgewogICAgICAKICAgICAgICB0ZW1wLmVyYXNlKDAsIHRlbXAuZmluZF9maXJzdF9ub3Rfb2YoIiBcdCIpKTsKICAgICAgICB0ZW1wLmVyYXNlKHRlbXAuZmluZF9sYXN0X25vdF9vZigiIFx0IikgKyAxKTsKCiAgICAgICAgaWYgKCF0ZW1wLmVtcHR5KCkpIHsKICAgICAgICAgICAgYXJyLnB1c2hfYmFjayhzdG9pKHRlbXApKTsgCiAgICAgICAgfQogICAgfQoKICAgIGludCBsYXJnZXN0ID0gZmluZExhcmdlc3ROdW1iZXIoYXJyKTsKCiAgICBjb3V0IDw8ICBsYXJnZXN0OwoKICAgIHJldHVybiAwOwp9Cg=="
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8c3N0cmVhbT4KI2luY2x1ZGUgPHZlY3Rvcj4KI2luY2x1ZGUgPHN0cmluZz4KI2luY2x1ZGUgPGFsZ29yaXRobT4KCnVzaW5nIG5hbWVzcGFjZSBzdGQ7CgovLyBGdW5jdGlvbiB0byBmaW5kIHRoZSBsYXJnZXN0IG51bWJlciBpbiB0aGUgYXJyYXkKaW50IGZpbmRMYXJnZXN0TnVtYmVyKGNvbnN0IHZlY3RvcjxpbnQ+JiBhcnIpIHsKICAgIC8vd3JpdGUgeW91ciBjb2RlIGhlcmUKICAgIHJldHVybiAwOwp9CgppbnQgbWFpbigpIHsKICAgIHN0cmluZyBpbnB1dDsKICAgIGdldGxpbmUoY2luLCBpbnB1dCk7CgogICAgaWYgKGlucHV0LmZyb250KCkgPT0gJ1snKSBpbnB1dCA9IGlucHV0LnN1YnN0cigxKTsKICAgIGlmIChpbnB1dC5iYWNrKCkgPT0gJ10nKSBpbnB1dCA9IGlucHV0LnN1YnN0cigwLCBpbnB1dC5zaXplKCkgLSAxKTsKCiAgICBzdHJpbmdzdHJlYW0gc3MoaW5wdXQpOwogICAgc3RyaW5nIHRlbXA7CiAgICB2ZWN0b3I8aW50PiBhcnI7CgogICAgCiAgICB3aGlsZSAoZ2V0bGluZShzcywgdGVtcCwgJywnKSkgewogICAgICAKICAgICAgICB0ZW1wLmVyYXNlKDAsIHRlbXAuZmluZF9maXJzdF9ub3Rfb2YoIiBcdCIpKTsKICAgICAgICB0ZW1wLmVyYXNlKHRlbXAuZmluZF9sYXN0X25vdF9vZigiIFx0IikgKyAxKTsKCiAgICAgICAgaWYgKCF0ZW1wLmVtcHR5KCkpIHsKICAgICAgICAgICAgYXJyLnB1c2hfYmFjayhzdG9pKHRlbXApKTsgCiAgICAgICAgfQogICAgfQoKICAgIGludCBsYXJnZXN0ID0gZmluZExhcmdlc3ROdW1iZXIoYXJyKTsKCiAgICBjb3V0IDw8ICBsYXJnZXN0OwoKICAgIHJldHVybiAwOwp9Cg=="
            },
            "c": {
                id: 104,
                name: "C",
                template: "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgoKLy8gRnVuY3Rpb24gdG8gZmluZCB0aGUgbGFyZ2VzdCBudW1iZXIgaW4gYW4gYXJyYXkKaW50IGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGludCBhcnJbXSkgewogICAgLy93cml0ZSB5b3VyIGNvZGUgaGVyZQogICAgcmV0dXJuIDA7Cn0KCmludCBtYWluKCkgewogICAgY2hhciBpbnB1dFsxMDAwXTsKCgogICAgZmdldHMoaW5wdXQsIHNpemVvZihpbnB1dCksIHN0ZGluKTsKCiAgCiAgICBpbnB1dFtzdHJjc3BuKGlucHV0LCAiXG4iKV0gPSAwOwoKICAgIGNoYXIqIHB0ciA9IHN0cmNocihpbnB1dCwgJ1snKTsKICAgIGlmIChwdHIgIT0gTlVMTCkgewogICAgICAgIG1lbW1vdmUoaW5wdXQsIHB0ciArIDEsIHN0cmxlbihwdHIpKTsgCiAgICB9CgogICAgcHRyID0gc3RyY2hyKGlucHV0LCAnXScpOwogICAgaWYgKHB0ciAhPSBOVUxMKSB7CiAgICAgICAgKnB0ciA9ICdcMCc7CiAgICB9CgogICAgaW50IGFyclsxMDBdOwogICAgaW50IHNpemUgPSAwOwoKICAgIGNoYXIqIHRva2VuID0gc3RydG9rKGlucHV0LCAiLCIpOwogICAgd2hpbGUgKHRva2VuICE9IE5VTEwpIHsKICAgICAgICBhcnJbc2l6ZV0gPSBhdG9pKHRva2VuKTsgCiAgICAgICAgc2l6ZSsrOwogICAgICAgIHRva2VuID0gc3RydG9rKE5VTEwsICIsIik7CiAgICB9CgogICAgYXJyW3NpemVdID0gLTE7IAoKICAgIGludCBsYXJnZXN0ID0gbGFyZ2VzdF9udW1iZXJfaW5fYXJyYXkoYXJyKTsKCiAgICBwcmludGYoIiVkXG4iLCBsYXJnZXN0KTsKCiAgICByZXR1cm4gMDsKfQo="
            }
        },
        71: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "ZGVmIGFuYWdyYW0oYSwgYik6CiAgICAjd3JpdGUgeW91ciBjb2RlIGhlcmUKICAgIHJldHVybiAwCgojIElucHV0IGRhdGEKYSA9IGlucHV0KCkuc3RyaXAoKQpiID0gaW5wdXQoKS5zdHJpcCgpCgojIENhbGwgZnVuY3Rpb24gYW5kIHByaW50IHJlc3VsdCBhcyAwIG9yIDEKcmVzdWx0ID0gYW5hZ3JhbShhLCBiKQpwcmludChyZXN1bHQpCg=="
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8c3RyaW5nPgojaW5jbHVkZSA8YWxnb3JpdGhtPgoKdXNpbmcgbmFtZXNwYWNlIHN0ZDsKCi8vIEZ1bmN0aW9uIHRvIGNoZWNrIGlmIHR3byBzdHJpbmdzIGFyZSBhbmFncmFtcwppbnQgYW5hZ3JhbShzdHJpbmcgX2FfLCBzdHJpbmcgX2JfKSB7CiAgICAvL3dyaXRlIHlvdXIgY29kZSBoZXJlCiAgICByZXR1cm4gMDsKfQoKaW50IG1haW4oKSB7CiAgICBzdHJpbmcgX2FfLCBfYl87CiAgICAvLyBJbnB1dCBkYXRhCiAgICBnZXRsaW5lKGNpbiwgX2FfKTsKICAgIGdldGxpbmUoY2luLCBfYl8pOwoKICAgIC8vIENhbGwgZnVuY3Rpb24gYW5kIHByaW50IHJlc3VsdAogICAgYXV0byByZXN1bHQgPSBhbmFncmFtKF9hXywgX2JfKTsKICAgIGNvdXQgPDwgcmVzdWx0OwoKICAgIHJldHVybiAwOwp9Cg=="
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOwoKcHVibGljIGNsYXNzIE1haW4gewogICAgLy8gRnVuY3Rpb24gdG8gY2hlY2sgaWYgdHdvIHN0cmluZ3MgYXJlIGFuYWdyYW1zCiAgICBwdWJsaWMgc3RhdGljIGludCBhbmFncmFtKFN0cmluZyBzMSwgU3RyaW5nIHMyKSB7CiAgICAgICAgLy93cml0ZSB5b3VyIGNvZGUgaGVyZQogICAgICAgIHJldHVybiAwOwogICAgfQoKICAgIHB1YmxpYyBzdGF0aWMgdm9pZCBtYWluKFN0cmluZ1tdIGFyZ3MpIHsKICAgICAgICBTY2FubmVyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcihTeXN0ZW0uaW4pOwoKICAgICAgICAvLyBJbnB1dCBkYXRhCiAgICAgICAgU3RyaW5nIGEgPSBzY2FubmVyLm5leHRMaW5lKCkudHJpbSgpOwogICAgICAgIFN0cmluZyBiID0gc2Nhbm5lci5uZXh0TGluZSgpLnRyaW0oKTsKCiAgICAgICAgLy8gQ2FsbCBmdW5jdGlvbiBhbmQgcHJpbnQgcmVzdWx0IGFzIDAgb3IgMQogICAgICAgIGludCByZXN1bHQgPSBhbmFncmFtKGEsIGIpOwogICAgICAgIFN5c3RlbS5vdXQucHJpbnRsbihyZXN1bHQpOwoKICAgICAgICBzY2FubmVyLmNsb3NlKCk7CiAgICB9Cn0K"
            },
            "c": {
                id: 104,
                name: "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdHJpbmcuaD4KI2luY2x1ZGUgPGN0eXBlLmg+CgovLyBGdW5jdGlvbiB0byBjaGVjayBpZiB0d28gc3RyaW5ncyBhcmUgYW5hZ3JhbXMKaW50IGFuYWdyYW1zKGNoYXIgczFbXSwgY2hhciBzMltdKSB7CiAgICAvL3dyaXRlIHlvdXIgY29kZSBoZXJlCiAgICByZXR1cm4gMDsKfQoKaW50IG1haW4oKSB7CiAgICBjaGFyIHMxWzEwMF0sIHMyWzEwMF07CgogICAgZmdldHMoczEsIHNpemVvZihzMSksIHN0ZGluKTsKICAgIGZnZXRzKHMyLCBzaXplb2YoczIpLCBzdGRpbik7CiAgICBzMVtzdHJjc3BuKHMxLCAiXG4iKV0gPSAnXDAnOwogICAgczJbc3RyY3NwbihzMiwgIlxuIildID0gJ1wwJzsKCiAgICBpbnQgcmVzdWx0ID0gYW5hZ3JhbXMoczEsIHMyKTsKCiAgICBwcmludGYoIiVkXG4iLCByZXN1bHQpOwoKICAgIHJldHVybiAwOwp9Cg=="
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
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgojaW5jbHVkZSA8bGltaXRzLmg+CgovLyBGdW5jdGlvbiB0byBmaW5kIHRoZSBzZWNvbmQgbGFyZ2VzdCBlbGVtZW50CmludCBzZWNvbmRMYXJnZXN0KGludCBhcnJbXSwgaW50IG4pIHsKICAgIC8vd3JpdGUgeW91ciBjb2RlIGhlcmUKICAgcmV0dXJuIDA7Cn0KCmludCBtYWluKCkgewogICAgY2hhciBpbnB1dFsxMDAwXTsgCiAgICBmZ2V0cyhpbnB1dCwgc2l6ZW9mKGlucHV0KSwgc3RkaW4pOwoKICAgIGlucHV0W3N0cmNzcG4oaW5wdXQsICJcbiIpXSA9ICdcMCc7CgoKICAgIGludCBhcnJbMTAwXTsgIAogICAgaW50IG4gPSAwOyAgCgogICAgY2hhciAqdG9rZW4gPSBzdHJ0b2soaW5wdXQsICIsIik7IAoKICAgCiAgICB3aGlsZSAodG9rZW4gIT0gTlVMTCkgewogICAgICAgIGFycltuKytdID0gYXRvaSh0b2tlbik7ICAKICAgICAgICB0b2tlbiA9IHN0cnRvayhOVUxMLCAiLCIpOyAgCiAgICB9CgoKICAgIGludCByZXN1bHQgPSBzZWNvbmRMYXJnZXN0KGFyciwgbik7CgoKICAgIHByaW50ZigiJWRcbiIsIHJlc3VsdCk7CgogICAgcmV0dXJuIDA7Cn0K"
            },
            "c": {
                id: 104,
                name: "C",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8c3RyaW5nPgojaW5jbHVkZSA8YWxnb3JpdGhtPgoKdXNpbmcgbmFtZXNwYWNlIHN0ZDsKCi8vIEZ1bmN0aW9uIHRvIGNoZWNrIGlmIHR3byBzdHJpbmdzIGFyZSBhbmFncmFtcwppbnQgYW5hZ3JhbShzdHJpbmcgX2FfLCBzdHJpbmcgX2JfKSB7CiAgICAvL3dyaXRlIHlvdXIgY29kZSBoZXJlCiAgICByZXR1cm4gMDsKfQoKaW50IG1haW4oKSB7CiAgICBzdHJpbmcgX2FfLCBfYl87CiAgICAvLyBJbnB1dCBkYXRhCiAgICBnZXRsaW5lKGNpbiwgX2FfKTsKICAgIGdldGxpbmUoY2luLCBfYl8pOwoKICAgIC8vIENhbGwgZnVuY3Rpb24gYW5kIHByaW50IHJlc3VsdAogICAgYXV0byByZXN1bHQgPSBhbmFncmFtKF9hXywgX2JfKTsKICAgIGNvdXQgPDwgcmVzdWx0OwoKICAgIHJldHVybiAwOwp9Cg=="
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
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8dmVjdG9yPgojaW5jbHVkZSA8c3N0cmVhbT4KCnVzaW5nIG5hbWVzcGFjZSBzdGQ7CgovLyBGdW5jdGlvbiB0byBjaGVjayBpZiBhbiBhcnJheSBpcyBzb3J0ZWQgaW4gYXNjZW5kaW5nIG9yZGVyCmludCBzb3J0ZWRfYXJyYXkodmVjdG9yPGludD4gJmEpIHsKICAgIHJldHVybiAwOwp9CgppbnQgbWFpbigpIHsKICAgIHN0cmluZyBpbnB1dDsKICAgIGdldGxpbmUoY2luLCBpbnB1dCk7CiAgICAKICAgIHZlY3RvcjxpbnQ+IGFycjsKICAgIHN0cmluZ3N0cmVhbSBzcyhpbnB1dCk7CiAgICBpbnQgbnVtOwoKICAgIHdoaWxlIChzcyA+PiBudW0pIHsKICAgICAgICBhcnIucHVzaF9iYWNrKG51bSk7CiAgICB9CgogICAgY291dCA8PCBzb3J0ZWRfYXJyYXkoYXJyKSA8PCBlbmRsOwogICAgcmV0dXJuIDA7Cn0K"
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOw0KDQpwdWJsaWMgY2xhc3MgTWFpbiB7DQogICAgLy8gRnVuY3Rpb24gdG8gY2hlY2sgaWYgYW4gYXJyYXkgaXMgc29ydGVkIGluIGFzY2VuZGluZyBvcmRlcg0KICAgIHB1YmxpYyBzdGF0aWMgaW50IHNvcnRlZF9hcnJheShpbnRbXSBhKSB7DQogICAgICAgIHJldHVybiAwOw0KICAgIH0NCg0KICAgIHB1YmxpYyBzdGF0aWMgdm9pZCBtYWluKFN0cmluZ1tdIGFyZ3MpIHsNCiAgICAgICAgU2Nhbm5lciBzY2FubmVyID0gbmV3IFNjYW5uZXIoU3lzdGVtLmluKTsNCiAgICAgICAgU3RyaW5nIGlucHV0ID0gc2Nhbm5lci5uZXh0TGluZSgpOw0KICAgICAgICANCiAgICAgICAgU3RyaW5nW10gdG9rZW5zID0gaW5wdXQuc3BsaXQoIiAiKTsNCiAgICAgICAgaW50W10gYXJyID0gbmV3IGludFt0b2tlbnMubGVuZ3RoXTsNCg0KICAgICAgICBmb3IgKGludCBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykgew0KICAgICAgICAgICAgYXJyW2ldID0gSW50ZWdlci5wYXJzZUludCh0b2tlbnNbaV0pOw0KICAgICAgICB9DQoNCiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKHNvcnRlZF9hcnJheShhcnIpKTsNCiAgICAgICAgc2Nhbm5lci5jbG9zZSgpOw0KICAgIH0NCn0NCg=="
            }, 
            "c": {
                id: 104,
                name: "C",
                template: "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgoKLy8gRnVuY3Rpb24gdG8gY2hlY2sgaWYgYW4gYXJyYXkgaXMgc29ydGVkIGluIGFzY2VuZGluZyBvcmRlcgppbnQgc29ydGVkX2FycmF5KGludCBhW10sIGludCBzaXplKSB7CiAgICBmb3IgKGludCBpID0gMTsgaSA8IHNpemU7IGkrKykgewogICAgICAgIGlmIChhW2ldIDwgYVtpIC0gMV0pIHsKICAgICAgICAgICAgcmV0dXJuIDA7CiAgICAgICAgfQogICAgfQogICAgcmV0dXJuIDE7Cn0KCmludCBtYWluKCkgewogICAgY2hhciBpbnB1dFsxMDAwXTsKICAgIGZnZXRzKGlucHV0LCBzaXplb2YoaW5wdXQpLCBzdGRpbik7CgogICAgaW50IGFyclsxMDBdLCBuID0gMDsKICAgIGNoYXIgKnRva2VuID0gc3RydG9rKGlucHV0LCAiICIpOwogICAgCiAgICB3aGlsZSAodG9rZW4gIT0gTlVMTCkgewogICAgICAgIGFycltuKytdID0gYXRvaSh0b2tlbik7CiAgICAgICAgdG9rZW4gPSBzdHJ0b2soTlVMTCwgIiAiKTsKICAgIH0KCiAgICBwcmludGYoIiVkXG4iLCBzb3J0ZWRfYXJyYXkoYXJyLCBuKSk7CiAgICByZXR1cm4gMDsKfQo="
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
            },
            "c":{
                id: 104,
                name: "C",
                template: "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgoKdm9pZCBmaWJvbmFjY2lfc2VyaWVzKGludCBuKSB7CiAgICBpZiAobiA9PSAwKSB7CiAgICAgICAgcHJpbnRmKCJbXVxuIik7CiAgICAgICAgcmV0dXJuOwogICAgfSBlbHNlIGlmIChuID09IDEpIHsKICAgICAgICBwcmludGYoIlswXVxuIik7CiAgICAgICAgcmV0dXJuOwogICAgfQoKICAgIGludCBmaWJbbl07CiAgICBmaWJbMF0gPSAwOwogICAgZmliWzFdID0gMTsKCiAgICBmb3IgKGludCBpID0gMjsgaSA8IG47IGkrKykgewogICAgICAgIGZpYltpXSA9IGZpYltpIC0gMV0gKyBmaWJbaSAtIDJdOwogICAgfQoKICAgIC8vIFByaW50IHRoZSBGaWJvbmFjY2kgc2VyaWVzIGluIGFycmF5IGZvcm1hdAogICAgcHJpbnRmKCJbIik7CiAgICBmb3IgKGludCBpID0gMDsgaSA8IG47IGkrKykgewogICAgICAgIHByaW50ZigiJWQiLCBmaWJbaV0pOwogICAgICAgIGlmIChpICE9IG4gLSAxKSBwcmludGYoIiwgIik7CiAgICB9CiAgICBwcmludGYoIl1cbiIpOwp9CgppbnQgbWFpbigpIHsKICAgIGNoYXIgaW5wdXRfc3RyWzUwXTsKICAgIGZnZXRzKGlucHV0X3N0ciwgc2l6ZW9mKGlucHV0X3N0ciksIHN0ZGluKTsgLy8gUmVhZCBpbnB1dCBhcyBhIHN0cmluZwogICAgaW50IG4gPSBhdG9pKGlucHV0X3N0cik7IC8vIENvbnZlcnQgc3RyaW5nIHRvIGludGVnZXIKCiAgICBmaWJvbmFjY2lfc2VyaWVzKG4pOwogICAgcmV0dXJuIDA7Cn0K"
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
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8dmVjdG9yPgojaW5jbHVkZSA8c3N0cmVhbT4KCnVzaW5nIG5hbWVzcGFjZSBzdGQ7Cgp2ZWN0b3I8aW50PiBhcnJheV9hbHRlcm5hdGUodmVjdG9yPGludD4mIGFycikgewogICAgdmVjdG9yPGludD4gcmVzdWx0KGFyci5zaXplKCkpOwogICAgaW50IGxlZnQgPSAwLCByaWdodCA9IGFyci5zaXplKCkgLSAxLCBpbmRleCA9IDA7CgogICAgd2hpbGUgKGxlZnQgPD0gcmlnaHQpIHsKICAgICAgICBpZiAoaW5kZXggJSAyID09IDApIHsKICAgICAgICAgICAgcmVzdWx0W2luZGV4XSA9IGFycltyaWdodC0tXTsgLy8gVGFrZSBsYXJnZXN0IGVsZW1lbnQKICAgICAgICB9IGVsc2UgewogICAgICAgICAgICByZXN1bHRbaW5kZXhdID0gYXJyW2xlZnQrK107IC8vIFRha2Ugc21hbGxlc3QgZWxlbWVudAogICAgICAgIH0KICAgICAgICBpbmRleCsrOwogICAgfQogICAgcmV0dXJuIHJlc3VsdDsKfQoKaW50IG1haW4oKSB7CiAgICBzdHJpbmcgaW5wdXQ7CiAgICBnZXRsaW5lKGNpbiwgaW5wdXQpOwoKICAgIHZlY3RvcjxpbnQ+IGFycjsKICAgIHN0cmluZ3N0cmVhbSBzcyhpbnB1dCk7CiAgICBjaGFyIGNoOwogICAgaW50IG51bTsKCiAgICB3aGlsZSAoc3MgPj4gY2gpIHsKICAgICAgICBpZiAoaXNkaWdpdChjaCkgfHwgY2ggPT0gJy0nKSB7CiAgICAgICAgICAgIHNzLnB1dGJhY2soY2gpOwogICAgICAgICAgICBzcyA+PiBudW07CiAgICAgICAgICAgIGFyci5wdXNoX2JhY2sobnVtKTsKICAgICAgICB9CiAgICB9CgogICAgdmVjdG9yPGludD4gcmVzdWx0ID0gYXJyYXlfYWx0ZXJuYXRlKGFycik7CiAgICAKICAgIC8vIFByaW50IHJlc3VsdCBpbiBtYWluCiAgICBjb3V0IDw8ICJbIjsKICAgIGZvciAoc2l6ZV90IGkgPSAwOyBpIDwgcmVzdWx0LnNpemUoKTsgaSsrKSB7CiAgICAgICAgY291dCA8PCByZXN1bHRbaV07CiAgICAgICAgaWYgKGkgIT0gcmVzdWx0LnNpemUoKSAtIDEpIGNvdXQgPDwgIiwgIjsKICAgIH0KICAgIGNvdXQgPDwgIl0iIDw8IGVuZGw7CgogICAgcmV0dXJuIDA7Cn0K"
            },
            "c": {
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgoKdm9pZCBhcnJheV9hbHRlcm5hdGUoaW50IGFycltdLCBpbnQgbiwgaW50IHJlc3VsdFtdKSB7CiAgICBpbnQgbGVmdCA9IDAsIHJpZ2h0ID0gbiAtIDEsIGluZGV4ID0gMDsKICAgIHdoaWxlIChsZWZ0IDw9IHJpZ2h0KSB7CiAgICAgICAgaWYgKGluZGV4ICUgMiA9PSAwKSB7CiAgICAgICAgICAgIHJlc3VsdFtpbmRleF0gPSBhcnJbcmlnaHQtLV07ICAvLyBUYWtlIGxhcmdlc3QgZWxlbWVudAogICAgICAgIH0gZWxzZSB7CiAgICAgICAgICAgIHJlc3VsdFtpbmRleF0gPSBhcnJbbGVmdCsrXTsgIC8vIFRha2Ugc21hbGxlc3QgZWxlbWVudAogICAgICAgIH0KICAgICAgICBpbmRleCsrOwogICAgfQp9CgppbnQgbWFpbigpIHsKICAgIGNoYXIgaW5wdXRbMTAwMF07CiAgICBmZ2V0cyhpbnB1dCwgc2l6ZW9mKGlucHV0KSwgc3RkaW4pOyAgLy8gUmVhZCBpbnB1dCBhcyBhIHN0cmluZwoKICAgIGludCBhcnJbMTAwXSwgbiA9IDA7CiAgICBjaGFyICp0b2tlbiA9IHN0cnRvayhpbnB1dCwgIiAsW11cbiIpOwogICAgd2hpbGUgKHRva2VuICE9IE5VTEwpIHsKICAgICAgICBhcnJbbisrXSA9IGF0b2kodG9rZW4pOyAgLy8gQ29udmVydCBzdHJpbmcgdG8gaW50ZWdlcgogICAgICAgIHRva2VuID0gc3RydG9rKE5VTEwsICIgLFtdXG4iKTsKICAgIH0KCiAgICBpbnQgcmVzdWx0W25dOwogICAgYXJyYXlfYWx0ZXJuYXRlKGFyciwgbiwgcmVzdWx0KTsKCiAgICAvLyBQcmludCByZXN1bHQgaW4gbWFpbgogICAgcHJpbnRmKCJbIik7CiAgICBmb3IgKGludCBpID0gMDsgaSA8IG47IGkrKykgewogICAgICAgIHByaW50ZigiJWQiLCByZXN1bHRbaV0pOwogICAgICAgIGlmIChpICE9IG4gLSAxKSBwcmludGYoIiwgIik7CiAgICB9CiAgICBwcmludGYoIl1cbiIpOwoKICAgIHJldHVybiAwOwp9Cg=="
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
                "template": "aW1wb3J0IHN5cwoKZGVmIG1pc3NpbmdfcG9zaXRpdmVfaW50ZWdlcihhcnIpOgogICAgbiA9IGxlbihhcnIpCiAgICBmb3IgaSBpbiByYW5nZShuKToKICAgICAgICB3aGlsZSAwIDwgYXJyW2ldIDw9IG4gYW5kIGFyclthcnJbaV0gLSAxXSAhPSBhcnJbaV06CiAgICAgICAgICAgIGFyclthcnJbaV0gLSAxXSwgYXJyW2ldID0gYXJyW2ldLCBhcnJbYXJyW2ldIC0gMV0KCiAgICBmb3IgaSBpbiByYW5nZShuKToKICAgICAgICBpZiBhcnJbaV0gIT0gaSArIDE6CiAgICAgICAgICAgIHJldHVybiBpICsgMQogICAgcmV0dXJuIG4gKyAxCgppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOgogICAgaW5wdXRfc3RyID0gc3lzLnN0ZGluLnJlYWQoKS5zdHJpcCgpCiAgICAKICAgICMgQ29udmVydCBpbnB1dCBzdHJpbmcgdG8gYSBsaXN0IG9mIGludGVnZXJzCiAgICBpbnB1dF9zdHIgPSBpbnB1dF9zdHIucmVwbGFjZSgiWyIsICIiKS5yZXBsYWNlKCJdIiwgIiIpCiAgICBhcnIgPSBsaXN0KG1hcChpbnQsIGlucHV0X3N0ci5zcGxpdCgiLCIpKSkKCiAgICByZXN1bHQgPSBtaXNzaW5nX3Bvc2l0aXZlX2ludGVnZXIoYXJyKQogICAgcHJpbnQocmVzdWx0KQo="
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8dmVjdG9yPgojaW5jbHVkZSA8c3N0cmVhbT4KCnVzaW5nIG5hbWVzcGFjZSBzdGQ7CgppbnQgbWlzc2luZ19wb3NpdGl2ZV9pbnRlZ2VyKHZlY3RvcjxpbnQ+JiBhcnIpIHsKICAgIGludCBuID0gYXJyLnNpemUoKTsKICAgIGZvciAoaW50IGkgPSAwOyBpIDwgbjsgaSsrKSB7CiAgICAgICAgd2hpbGUgKGFycltpXSA+IDAgJiYgYXJyW2ldIDw9IG4gJiYgYXJyW2FycltpXSAtIDFdICE9IGFycltpXSkgewogICAgICAgICAgICBzd2FwKGFycltpXSwgYXJyW2FycltpXSAtIDFdKTsKICAgICAgICB9CiAgICB9CiAgICAKICAgIGZvciAoaW50IGkgPSAwOyBpIDwgbjsgaSsrKSB7CiAgICAgICAgaWYgKGFycltpXSAhPSBpICsgMSkgcmV0dXJuIGkgKyAxOwogICAgfQogICAgcmV0dXJuIG4gKyAxOwp9CgppbnQgbWFpbigpIHsKICAgIHN0cmluZyBpbnB1dDsKICAgIGdldGxpbmUoY2luLCBpbnB1dCk7CgogICAgdmVjdG9yPGludD4gYXJyOwogICAgc3RyaW5nc3RyZWFtIHNzKGlucHV0KTsKICAgIGNoYXIgY2g7CiAgICBpbnQgbnVtOwoKICAgIHdoaWxlIChzcyA+PiBjaCkgewogICAgICAgIGlmIChpc2RpZ2l0KGNoKSB8fCBjaCA9PSAnLScpIHsKICAgICAgICAgICAgc3MucHV0YmFjayhjaCk7CiAgICAgICAgICAgIHNzID4+IG51bTsKICAgICAgICAgICAgYXJyLnB1c2hfYmFjayhudW0pOwogICAgICAgIH0KICAgIH0KCiAgICBpbnQgcmVzdWx0ID0gbWlzc2luZ19wb3NpdGl2ZV9pbnRlZ2VyKGFycik7CiAgICBjb3V0IDw8IHJlc3VsdCA8PCBlbmRsOwoKICAgIHJldHVybiAwOwp9Cg=="
            },
            "c": {
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgoKaW50IG1pc3NpbmdfcG9zaXRpdmVfaW50ZWdlcihpbnQgYXJyW10sIGludCBuKSB7CiAgICBmb3IgKGludCBpID0gMDsgaSA8IG47IGkrKykgewogICAgICAgIHdoaWxlIChhcnJbaV0gPiAwICYmIGFycltpXSA8PSBuICYmIGFyclthcnJbaV0gLSAxXSAhPSBhcnJbaV0pIHsKICAgICAgICAgICAgaW50IHRlbXAgPSBhcnJbaV07CiAgICAgICAgICAgIGFycltpXSA9IGFyclt0ZW1wIC0gMV07CiAgICAgICAgICAgIGFyclt0ZW1wIC0gMV0gPSB0ZW1wOwogICAgICAgIH0KICAgIH0KICAgIAogICAgZm9yIChpbnQgaSA9IDA7IGkgPCBuOyBpKyspIHsKICAgICAgICBpZiAoYXJyW2ldICE9IGkgKyAxKSByZXR1cm4gaSArIDE7CiAgICB9CiAgICByZXR1cm4gbiArIDE7Cn0KCmludCBtYWluKCkgewogICAgY2hhciBpbnB1dFsxMDAwXTsKICAgIGZnZXRzKGlucHV0LCBzaXplb2YoaW5wdXQpLCBzdGRpbik7CgogICAgaW50IGFyclsxMDBdLCBuID0gMDsKICAgIGNoYXIgKnRva2VuID0gc3RydG9rKGlucHV0LCAiICxbXVxuIik7CiAgICB3aGlsZSAodG9rZW4gIT0gTlVMTCkgewogICAgICAgIGFycltuKytdID0gYXRvaSh0b2tlbik7CiAgICAgICAgdG9rZW4gPSBzdHJ0b2soTlVMTCwgIiAsW11cbiIpOwogICAgfQoKICAgIGludCByZXN1bHQgPSBtaXNzaW5nX3Bvc2l0aXZlX2ludGVnZXIoYXJyLCBuKTsKICAgIHByaW50ZigiJWRcbiIsIHJlc3VsdCk7CgogICAgcmV0dXJuIDA7Cn0K"
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOwoKcHVibGljIGNsYXNzIE1haW4gewogICAgcHVibGljIHN0YXRpYyBpbnQgbWlzc2luZ1Bvc2l0aXZlSW50ZWdlcihpbnRbXSBhcnIpIHsKICAgICAgICBpbnQgbiA9IGFyci5sZW5ndGg7CiAgICAgICAgZm9yIChpbnQgaSA9IDA7IGkgPCBuOyBpKyspIHsKICAgICAgICAgICAgd2hpbGUgKGFycltpXSA+IDAgJiYgYXJyW2ldIDw9IG4gJiYgYXJyW2FycltpXSAtIDFdICE9IGFycltpXSkgewogICAgICAgICAgICAgICAgaW50IHRlbXAgPSBhcnJbaV07CiAgICAgICAgICAgICAgICBhcnJbaV0gPSBhcnJbdGVtcCAtIDFdOwogICAgICAgICAgICAgICAgYXJyW3RlbXAgLSAxXSA9IHRlbXA7CiAgICAgICAgICAgIH0KICAgICAgICB9CgogICAgICAgIGZvciAoaW50IGkgPSAwOyBpIDwgbjsgaSsrKSB7CiAgICAgICAgICAgIGlmIChhcnJbaV0gIT0gaSArIDEpIHJldHVybiBpICsgMTsKICAgICAgICB9CiAgICAgICAgcmV0dXJuIG4gKyAxOwogICAgfQoKICAgIHB1YmxpYyBzdGF0aWMgdm9pZCBtYWluKFN0cmluZ1tdIGFyZ3MpIHsKICAgICAgICBTY2FubmVyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcihTeXN0ZW0uaW4pOwogICAgICAgIFN0cmluZyBpbnB1dCA9IHNjYW5uZXIubmV4dExpbmUoKS5yZXBsYWNlQWxsKCJbXFxbXFxdXSIsICIiKTsKICAgICAgICBzY2FubmVyLmNsb3NlKCk7CgogICAgICAgIExpc3Q8SW50ZWdlcj4gYXJyTGlzdCA9IG5ldyBBcnJheUxpc3Q8PigpOwogICAgICAgIGZvciAoU3RyaW5nIG51bSA6IGlucHV0LnNwbGl0KCIsIikpIHsKICAgICAgICAgICAgYXJyTGlzdC5hZGQoSW50ZWdlci5wYXJzZUludChudW0udHJpbSgpKSk7CiAgICAgICAgfQoKICAgICAgICBpbnRbXSBhcnIgPSBhcnJMaXN0LnN0cmVhbSgpLm1hcFRvSW50KGkgLT4gaSkudG9BcnJheSgpOwogICAgICAgIGludCByZXN1bHQgPSBtaXNzaW5nUG9zaXRpdmVJbnRlZ2VyKGFycik7CiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKHJlc3VsdCk7CiAgICB9Cn0K"
            }
        },
        21: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "ZGVmIGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGFycik6CiAgICAjIHdyaXRlIHlvdXIgY29kZSBoZXJlCiAgICByZXR1cm4gMCAgCgppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOgogICAKICAgIGlucHV0X3N0ciA9IGlucHV0KCkuc3RyaXAoKQogICAgCiAgICAKICAgIGFyciA9IGxpc3QobWFwKGludCwgaW5wdXRfc3RyLnNwbGl0KCIsIikpKQogICAgCiAgICByZXN1bHQgPSBsYXJnZXN0X251bWJlcl9pbl9hcnJheShhcnIpCiAgICBwcmludChyZXN1bHQpCg=="
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                template: "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8c3N0cmVhbT4KI2luY2x1ZGUgPHZlY3Rvcj4KdXNpbmcgbmFtZXNwYWNlIHN0ZDsKCi8vIEZ1bmN0aW9uIHRvIGZpbmQgdGhlIGxhcmdlc3QgbnVtYmVyIGluIGFuIGFycmF5CmludCBsYXJnZXN0X251bWJlcl9pbl9hcnJheSh2ZWN0b3I8aW50PiYgYXJyKSB7CiAgICByZXR1cm4gMDsKfQoKaW50IG1haW4oKSB7CiAgICBzdHJpbmcgaW5wdXQ7CiAgICBnZXRsaW5lKGNpbiwgaW5wdXQpOyAgLy8gUmVhZCBpbnB1dCBhcyBhIHN0cmluZwoKICAgIHZlY3RvcjxpbnQ+IGFycjsKICAgIHN0cmluZ3N0cmVhbSBzcyhpbnB1dCk7CiAgICBzdHJpbmcgdG9rZW47CgogICAgd2hpbGUgKGdldGxpbmUoc3MsIHRva2VuLCAnLCcpKSB7CiAgICAgICAgYXJyLnB1c2hfYmFjayhzdG9pKHRva2VuKSk7ICAvLyBDb252ZXJ0IHN0cmluZyB0b2tlbiB0byBpbnRlZ2VyCiAgICB9CgogICAgaW50IHJlc3VsdCA9IGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGFycik7CiAgICBjb3V0IDw8IHJlc3VsdCA8PCBlbmRsOwoKICAgIHJldHVybiAwOwp9Cg=="
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC5TY2FubmVyOwoKcHVibGljIGNsYXNzIE1haW4gewogICAgcHVibGljIHN0YXRpYyBpbnQgbGFyZ2VzdF9udW1iZXJfaW5fYXJyYXkoaW50W10gX2FfKSB7CiAgICAgICAgcmV0dXJuIDA7CiAgICB9CgogICAgcHVibGljIHN0YXRpYyB2b2lkIG1haW4oU3RyaW5nW10gYXJncykgewogICAgICAgIFNjYW5uZXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKFN5c3RlbS5pbik7CiAgICAgICAgCiAgICAgICAgLy8gUmVhZCB0aGUgaW5wdXQgYXJyYXkgYXMgYSBzdHJpbmcKICAgICAgICBTdHJpbmcgaW5wdXQgPSBzY2FubmVyLm5leHRMaW5lKCk7CiAgICAgICAgCiAgICAgICAgLy8gQ29udmVydCB0aGUgaW5wdXQgc3RyaW5nIGludG8gYW4gaW50ZWdlciBhcnJheQogICAgICAgIFN0cmluZ1tdIGlucHV0QXJyID0gaW5wdXQuc3BsaXQoIiwiKTsKICAgICAgICBpbnRbXSBfYV8gPSBuZXcgaW50W2lucHV0QXJyLmxlbmd0aF07CiAgICAgICAgCiAgICAgICAgZm9yIChpbnQgaSA9IDA7IGkgPCBpbnB1dEFyci5sZW5ndGg7IGkrKykgewogICAgICAgICAgICBfYV9baV0gPSBJbnRlZ2VyLnBhcnNlSW50KGlucHV0QXJyW2ldLnRyaW0oKSk7IC8vIFRyaW0gdG8gcmVtb3ZlIHNwYWNlcwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiBhbmQgcHJpbnQgdGhlIHJlc3VsdAogICAgICAgIGludCByZXN1bHQgPSBsYXJnZXN0X251bWJlcl9pbl9hcnJheShfYV8pOwogICAgICAgIFN5c3RlbS5vdXQucHJpbnRsbihyZXN1bHQpOwoKICAgICAgICBzY2FubmVyLmNsb3NlKCk7CiAgICB9Cn0K"
            },
            c: {
                id: 104,
                name: "C",
                template: "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgoKLy8gRnVuY3Rpb24gdG8gZmluZCB0aGUgbGFyZ2VzdCBudW1iZXIgaW4gYW4gYXJyYXkKaW50IGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGludCBhcnJbXSwgaW50IHNpemUpIHsKICAgIC8vd3JpdGUgeW91ciBjb2RlIGhlcmUKICAgIHJldHVybiAwOwp9CgppbnQgbWFpbigpIHsKICAgIGNoYXIgaW5wdXRbMTAwMF07ICAKICAgIGZnZXRzKGlucHV0LCBzaXplb2YoaW5wdXQpLCBzdGRpbik7CgogICAgaW50IGFyclsxMDBdLCBzaXplID0gMDsKICAgIGNoYXIgKnRva2VuID0gc3RydG9rKGlucHV0LCAiLCIpOyAKCiAgICB3aGlsZSAodG9rZW4gIT0gTlVMTCkgewogICAgICAgIGFycltzaXplKytdID0gYXRvaSh0b2tlbik7IAogICAgICAgIHRva2VuID0gc3RydG9rKE5VTEwsICIsIik7CiAgICB9CgogICAgaW50IHJlc3VsdCA9IGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGFyciwgc2l6ZSk7CiAgICBwcmludGYoIiVkXG4iLCByZXN1bHQpOwoKICAgIHJldHVybiAwOwp9Cg=="
            }
        }
    }
    return defTemplates[language_id];
}
