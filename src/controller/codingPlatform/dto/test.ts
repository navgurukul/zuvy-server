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
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CgovLyBGdW5jdGlvbiB0byBmaW5kIHRoZSBsYXJnZXN0IG9mIHRocmVlIG51bWJlcnMKaW50IGxhcmdlc3Rfb2ZfdGhyZWUoaW50IGEsIGludCBiLCBpbnQgYykgewogICAgLy93cml0ZSB5b3VyIGNvZGUgaGVyZQoKICAgIAp9CgppbnQgbWFpbigpIHsKICAgIGludCBhLCBiLCBjOwogICAgCiAgICAvLyBSZWFkIHRocmVlIG51bWJlcnMgYXMgaW5wdXQKICAgIHNjYW5mKCIlZCAlZCAlZCIsICZhLCAmYiwgJmMpOwogICAgCiAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB0byBnZXQgdGhlIGxhcmdlc3QgbnVtYmVyIGFuZCBwcmludCB0aGUgcmVzdWx0CiAgICBwcmludGYoIiVkXG4iLCBsYXJnZXN0X29mX3RocmVlKGEsIGIsIGMpKTsKICAgIAogICAgcmV0dXJuIDA7Cn0K"
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
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxjdHlwZS5oPiAgLy8gRm9yIHRoZSB0b2xvd2VyIGZ1bmN0aW9uCgppbnQgY291bnRWb3dlbHMoY2hhciBzdHJbXSkgewogICAgLy93cml0ZSB5b3VyIGNvZGUgaGVyZQogICAgcmV0dXJuIDA7Cgp9CgppbnQgbWFpbigpIHsKICAgIGNoYXIgc3RyWzEwMF07CgogICAgZmdldHMoc3RyLCBzaXplb2Yoc3RyKSwgc3RkaW4pOwoKICAgIGlmIChzdHJbc3RybGVuKHN0cikgLSAxXSA9PSAnXG4nKSB7CiAgICAgICAgc3RyW3N0cmxlbihzdHIpIC0gMV0gPSAnXDAnOwogICAgfQoKICAgIGludCB2b3dlbHMgPSBjb3VudFZvd2VscyhzdHIpOwoKICAgIHByaW50ZigiJWRcbiIsIHZvd2Vscyk7CgogICAgcmV0dXJuIDA7Cn0K"
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
                "template": "aW1wb3J0IGphdmEudXRpbC4qOwoKcHVibGljIGNsYXNzIE1haW4gewoKICAgIC8vIEZ1bmN0aW9uIHRvIGZpbmQgdGhlIGxhcmdlc3QgbnVtYmVyIGluIGFuIGFycmF5CiAgICBwdWJsaWMgc3RhdGljIGludCBsYXJnZXN0TnVtYmVySW5BcnJheShpbnRbXSBhcnIpIHsKICAgICAgICAvL3dyaXRlIHlvdXIgY29kZSBoZXJlCiAgICAgICAgcmV0dXJuIDA7CiAgICB9CgogICAgcHVibGljIHN0YXRpYyB2b2lkIG1haW4oU3RyaW5nW10gYXJncykgewogICAgICAgIFNjYW5uZXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKFN5c3RlbS5pbik7CgogICAgICAgIFN0cmluZyBpbnB1dCA9IHNjYW5uZXIubmV4dExpbmUoKTsKCiAgICAgCiAgICAgICAgaW5wdXQgPSBpbnB1dC5yZXBsYWNlKCJbIiwgIiIpLnJlcGxhY2UoIl0iLCAiIik7CgogICAgICAKICAgICAgICBTdHJpbmdbXSBlbGVtZW50cyA9IGlucHV0LnNwbGl0KCIsIik7CiAgICAgICAgaW50W10gYXJyID0gbmV3IGludFtlbGVtZW50cy5sZW5ndGhdOwoKICAgICAgIAogICAgICAgIGZvciAoaW50IGkgPSAwOyBpIDwgZWxlbWVudHMubGVuZ3RoOyBpKyspIHsKICAgICAgICAgICAgYXJyW2ldID0gSW50ZWdlci5wYXJzZUludChlbGVtZW50c1tpXS50cmltKCkpOwogICAgICAgIH0KCiAgICAgICAgaW50IGxhcmdlc3QgPSBsYXJnZXN0TnVtYmVySW5BcnJheShhcnIpOwoKICAgICAgICBTeXN0ZW0ub3V0LnByaW50bG4obGFyZ2VzdCk7CgogICAgICAgIHNjYW5uZXIuY2xvc2UoKTsKICAgIH0KfQo="
            },
            "c": {
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgoKLy8gRnVuY3Rpb24gdG8gZmluZCB0aGUgbGFyZ2VzdCBudW1iZXIgaW4gYW4gYXJyYXkKaW50IGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGludCBhcnJbXSkgewogICAgLy93cml0ZSB5b3VyIGNvZGUgaGVyZQogICAgcmV0dXJuIDA7Cn0KCmludCBtYWluKCkgewogICAgY2hhciBpbnB1dFsxMDAwXTsKCgogICAgZmdldHMoaW5wdXQsIHNpemVvZihpbnB1dCksIHN0ZGluKTsKCiAgCiAgICBpbnB1dFtzdHJjc3BuKGlucHV0LCAiXG4iKV0gPSAwOwoKICAgIGNoYXIqIHB0ciA9IHN0cmNocihpbnB1dCwgJ1snKTsKICAgIGlmIChwdHIgIT0gTlVMTCkgewogICAgICAgIG1lbW1vdmUoaW5wdXQsIHB0ciArIDEsIHN0cmxlbihwdHIpKTsgCiAgICB9CgogICAgcHRyID0gc3RyY2hyKGlucHV0LCAnXScpOwogICAgaWYgKHB0ciAhPSBOVUxMKSB7CiAgICAgICAgKnB0ciA9ICdcMCc7CiAgICB9CgogICAgaW50IGFyclsxMDBdOwogICAgaW50IHNpemUgPSAwOwoKICAgIGNoYXIqIHRva2VuID0gc3RydG9rKGlucHV0LCAiLCIpOwogICAgd2hpbGUgKHRva2VuICE9IE5VTEwpIHsKICAgICAgICBhcnJbc2l6ZV0gPSBhdG9pKHRva2VuKTsgCiAgICAgICAgc2l6ZSsrOwogICAgICAgIHRva2VuID0gc3RydG9rKE5VTEwsICIsIik7CiAgICB9CgogICAgYXJyW3NpemVdID0gLTE7IAoKICAgIGludCBsYXJnZXN0ID0gbGFyZ2VzdF9udW1iZXJfaW5fYXJyYXkoYXJyKTsKCiAgICBwcmludGYoIiVkXG4iLCBsYXJnZXN0KTsKCiAgICByZXR1cm4gMDsKfQo="
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
                "id": 104,
                "name": "C",
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
                "template": "aW1wb3J0IGphdmEudXRpbC4qOwoKcHVibGljIGNsYXNzIE1haW4gewoKICAgIC8vIEZ1bmN0aW9uIHRvIGZpbmQgdGhlIHNlY29uZCBsYXJnZXN0IG51bWJlciBpbiBhbiBhcnJheQogICAgcHVibGljIHN0YXRpYyBpbnQgc2Vjb25kTGFyZ2VzdChMaXN0PEludGVnZXI+IG51bWJlcnMpIHsKICAgICAgIC8vd3JpdGUgeW91ciBjb2RlIGhlcmUKICAgICAgIHJldHVybiAwOwogICAgfQoKICAgIHB1YmxpYyBzdGF0aWMgdm9pZCBtYWluKFN0cmluZ1tdIGFyZ3MpIHsKICAgICAgICBTY2FubmVyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcihTeXN0ZW0uaW4pOwogICAgICAgIFN0cmluZyBpbnB1dCA9IHNjYW5uZXIubmV4dExpbmUoKTsgLy8gUmVhZCB0aGUgZW50aXJlIGlucHV0IHN0cmluZwoKICAgICAgICAvLyBQYXJzZSB0aGUgc3RyaW5nIHRvIGV4dHJhY3QgaW5kaXZpZHVhbCBpbnRlZ2VycwogICAgICAgIExpc3Q8SW50ZWdlcj4gbnVtYmVycyA9IG5ldyBBcnJheUxpc3Q8PigpOwogICAgICAgIFN0cmluZ1tdIGVsZW1lbnRzID0gaW5wdXQuc3BsaXQoIiwiKTsKCiAgICAgICAgZm9yIChTdHJpbmcgZWxlbWVudCA6IGVsZW1lbnRzKSB7CiAgICAgICAgICAgIG51bWJlcnMuYWRkKEludGVnZXIucGFyc2VJbnQoZWxlbWVudC50cmltKCkpKTsKICAgICAgICB9CgogICAgICAgIC8vIENhbGwgdGhlIGZ1bmN0aW9uIGFuZCBwcmludCB0aGUgcmVzdWx0CiAgICAgICAgdHJ5IHsKICAgICAgICAgICAgaW50IHJlc3VsdCA9IHNlY29uZExhcmdlc3QobnVtYmVycyk7CiAgICAgICAgICAgIFN5c3RlbS5vdXQucHJpbnRsbihyZXN1bHQpOwogICAgICAgIH0gY2F0Y2ggKElsbGVnYWxBcmd1bWVudEV4Y2VwdGlvbiBlKSB7CiAgICAgICAgICAgIFN5c3RlbS5vdXQucHJpbnRsbigiRXJyb3I6ICIgKyBlLmdldE1lc3NhZ2UoKSk7CiAgICAgICAgfQoKICAgICAgICBzY2FubmVyLmNsb3NlKCk7CiAgICB9Cn0K"
            },
            "c": {
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgojaW5jbHVkZSA8bGltaXRzLmg+CgovLyBGdW5jdGlvbiB0byBmaW5kIHRoZSBzZWNvbmQgbGFyZ2VzdCBlbGVtZW50CmludCBzZWNvbmRMYXJnZXN0KGludCBhcnJbXSwgaW50IG4pIHsKICAgIC8vd3JpdGUgeW91ciBjb2RlIGhlcmUKICAgcmV0dXJuIDA7Cn0KCmludCBtYWluKCkgewogICAgY2hhciBpbnB1dFsxMDAwXTsgCiAgICBmZ2V0cyhpbnB1dCwgc2l6ZW9mKGlucHV0KSwgc3RkaW4pOwoKICAgIGlucHV0W3N0cmNzcG4oaW5wdXQsICJcbiIpXSA9ICdcMCc7CgoKICAgIGludCBhcnJbMTAwXTsgIAogICAgaW50IG4gPSAwOyAgCgogICAgY2hhciAqdG9rZW4gPSBzdHJ0b2soaW5wdXQsICIsIik7IAoKICAgCiAgICB3aGlsZSAodG9rZW4gIT0gTlVMTCkgewogICAgICAgIGFycltuKytdID0gYXRvaSh0b2tlbik7ICAKICAgICAgICB0b2tlbiA9IHN0cnRvayhOVUxMLCAiLCIpOyAgCiAgICB9CgoKICAgIGludCByZXN1bHQgPSBzZWNvbmRMYXJnZXN0KGFyciwgbik7CgoKICAgIHByaW50ZigiJWRcbiIsIHJlc3VsdCk7CgogICAgcmV0dXJuIDA7Cn0K"
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
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+DQojaW5jbHVkZSA8c3RkbGliLmg+DQojaW5jbHVkZSA8c3RyaW5nLmg+DQoNCi8vIEZ1bmN0aW9uIHRvIGNoZWNrIGlmIGFuIGFycmF5IGlzIHNvcnRlZCBpbiBhc2NlbmRpbmcgb3JkZXINCmludCBzb3J0ZWRfYXJyYXkoaW50IGFbXSwgaW50IHNpemUpIHsNCiAgICAvLyB3cml0ZSB5b3UgY29kZSBoZXJlDQogICAgcmV0dXJuIDE7DQp9DQoNCmludCBtYWluKCkgew0KICAgIGNoYXIgaW5wdXRbMTAwMF07DQogICAgZmdldHMoaW5wdXQsIHNpemVvZihpbnB1dCksIHN0ZGluKTsNCg0KICAgIGludCBhcnJbMTAwXSwgbiA9IDA7DQogICAgY2hhciAqdG9rZW4gPSBzdHJ0b2soaW5wdXQsICIgIik7DQogICAgDQogICAgd2hpbGUgKHRva2VuICE9IE5VTEwpIHsNCiAgICAgICAgYXJyW24rK10gPSBhdG9pKHRva2VuKTsNCiAgICAgICAgdG9rZW4gPSBzdHJ0b2soTlVMTCwgIiAiKTsNCiAgICB9DQoNCiAgICBwcmludGYoIiVkXG4iLCBzb3J0ZWRfYXJyYXkoYXJyLCBuKSk7DQogICAgcmV0dXJuIDA7DQp9DQo="
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
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KCi8vIEZ1bmN0aW9uIHRvIGdlbmVyYXRlIHRoZSBGaWJvbmFjY2kgc2VyaWVzIGFuZCByZXR1cm4gdGhlIGFycmF5CmludCogZ2VuZXJhdGVGaWJvbmFjY2koaW50IG4pIHsKICAgIC8vL3dyaXRlIHlvdXIgY29kZSBoZXJlCn0KCmludCBtYWluKCkgewogICAgaW50IG47CgogICAgc2NhbmYoIiVkIiwgJm4pOwoKICAgIGlmIChuIDw9IDAgfHwgbiA+IDUwKSB7CiAgICAgICAgcmV0dXJuIDE7CiAgICB9CgogICAgaW50KiBmaWJvbmFjY2lTZXJpZXMgPSBnZW5lcmF0ZUZpYm9uYWNjaShuKTsKCiAgICBwcmludGYoIlsiKTsKICAgIGZvciAoaW50IGkgPSAwOyBpIDwgbjsgaSsrKSB7CiAgICAgICAgcHJpbnRmKCIlZCIsIGZpYm9uYWNjaVNlcmllc1tpXSk7CiAgICAgICAgaWYgKGkgPCBuIC0gMSkgewogICAgICAgICAgICBwcmludGYoIiwgIik7CiAgICAgICAgfQogICAgfQogICAgcHJpbnRmKCJdIik7CgogICAgZnJlZShmaWJvbmFjY2lTZXJpZXMpOwoKICAgIHJldHVybiAwOwp9Cg=="
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
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8dmVjdG9yPgojaW5jbHVkZSA8c3N0cmVhbT4KCnVzaW5nIG5hbWVzcGFjZSBzdGQ7Cgp2ZWN0b3I8aW50PiBhcnJheV9hbHRlcm5hdGUodmVjdG9yPGludD4mIGFycikgewogICAgLy93cml0ZSB5b3VyIGNvZGUgaGVyZQogICAgcmV0dXJuOwp9CgppbnQgbWFpbigpIHsKICAgIHN0cmluZyBpbnB1dDsKICAgIGdldGxpbmUoY2luLCBpbnB1dCk7CgogICAgdmVjdG9yPGludD4gYXJyOwogICAgc3RyaW5nc3RyZWFtIHNzKGlucHV0KTsKICAgIGNoYXIgY2g7CiAgICBpbnQgbnVtOwoKICAgIHdoaWxlIChzcyA+PiBjaCkgewogICAgICAgIGlmIChpc2RpZ2l0KGNoKSB8fCBjaCA9PSAnLScpIHsKICAgICAgICAgICAgc3MucHV0YmFjayhjaCk7CiAgICAgICAgICAgIHNzID4+IG51bTsKICAgICAgICAgICAgYXJyLnB1c2hfYmFjayhudW0pOwogICAgICAgIH0KICAgIH0KCiAgICB2ZWN0b3I8aW50PiByZXN1bHQgPSBhcnJheV9hbHRlcm5hdGUoYXJyKTsKICAgIAogICAgLy8gUHJpbnQgcmVzdWx0IGluIG1haW4KICAgIGNvdXQgPDwgIlsiOwogICAgZm9yIChzaXplX3QgaSA9IDA7IGkgPCByZXN1bHQuc2l6ZSgpOyBpKyspIHsKICAgICAgICBjb3V0IDw8IHJlc3VsdFtpXTsKICAgICAgICBpZiAoaSAhPSByZXN1bHQuc2l6ZSgpIC0gMSkgY291dCA8PCAiLCAiOwogICAgfQogICAgY291dCA8PCAiXSIgPDwgZW5kbDsKCiAgICByZXR1cm4gMDsKfQo="
            },
            "c": {
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPGN0eXBlLmg+CiNpbmNsdWRlIDxzdHJpbmcuaD4KCnZvaWQgYXJyYXlfYWx0ZXJuYXRlKGludCogYXJyLCBpbnQgc2l6ZSwgaW50KiByZXN1bHQpIHsKICAgIC8vd3JpdGUgeW91ciBjb2RlIGhlcmUKfQoKaW50IG1haW4oKSB7CiAgICBjaGFyIGlucHV0WzEwMDBdOwogICAgZmdldHMoaW5wdXQsIHNpemVvZihpbnB1dCksIHN0ZGluKTsKCiAgICBpbnQgYXJyWzEwMDBdLCBzaXplID0gMDsKICAgIGNoYXIqIHRva2VuID0gc3RydG9rKGlucHV0LCAiW10sIFxuIik7CgogICAgd2hpbGUgKHRva2VuKSB7CiAgICAgICAgYXJyW3NpemUrK10gPSBhdG9pKHRva2VuKTsKICAgICAgICB0b2tlbiA9IHN0cnRvayhOVUxMLCAiW10sIFxuIik7CiAgICB9CgogICAgaW50IHJlc3VsdFsxMDAwXTsKICAgIGFycmF5X2FsdGVybmF0ZShhcnIsIHNpemUsIHJlc3VsdCk7CgogICAgLy8gUHJpbnQgcmVzdWx0CiAgICBwcmludGYoIlsiKTsKICAgIGZvciAoaW50IGkgPSAwOyBpIDwgc2l6ZTsgaSsrKSB7CiAgICAgICAgcHJpbnRmKCIlZCIsIHJlc3VsdFtpXSk7CiAgICAgICAgaWYgKGkgIT0gc2l6ZSAtIDEpIHByaW50ZigiLCAiKTsKICAgIH0KICAgIHByaW50ZigiXVxuIik7CgogICAgcmV0dXJuIDA7Cn0K"
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
                "template": "aW1wb3J0IHN5cwoKZGVmIG1pc3NpbmdfcG9zaXRpdmVfaW50ZWdlcihhcnIpOgogICAgI3dyaXRlIHlvdXIgY29kZSBoZXJlCgppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOgogICAgaW5wdXRfc3RyID0gc3lzLnN0ZGluLnJlYWQoKS5zdHJpcCgpCiAgICAKICAgIGlucHV0X3N0ciA9IGlucHV0X3N0ci5yZXBsYWNlKCJbIiwgIiIpLnJlcGxhY2UoIl0iLCAiIikKICAgIGFyciA9IGxpc3QobWFwKGludCwgaW5wdXRfc3RyLnNwbGl0KCIsIikpKQoKICAgIHJlc3VsdCA9IG1pc3NpbmdfcG9zaXRpdmVfaW50ZWdlcihhcnIpCiAgICBwcmludChyZXN1bHQpCg=="
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8dmVjdG9yPgojaW5jbHVkZSA8c3N0cmVhbT4KCnVzaW5nIG5hbWVzcGFjZSBzdGQ7CgppbnQgbWlzc2luZ19wb3NpdGl2ZV9pbnRlZ2VyKHZlY3RvcjxpbnQ+JiBhcnIpIHsKICAgIC8vd3JpdGUgeW91ciBjb2RlIGhlcmUKICAgIHJldHVybiAwOwp9CgppbnQgbWFpbigpIHsKICAgIHN0cmluZyBpbnB1dDsKICAgIGdldGxpbmUoY2luLCBpbnB1dCk7CgogICAgdmVjdG9yPGludD4gYXJyOwogICAgc3RyaW5nc3RyZWFtIHNzKGlucHV0KTsKICAgIGNoYXIgY2g7CiAgICBpbnQgbnVtOwoKICAgIHdoaWxlIChzcyA+PiBjaCkgewogICAgICAgIGlmIChpc2RpZ2l0KGNoKSB8fCBjaCA9PSAnLScpIHsKICAgICAgICAgICAgc3MucHV0YmFjayhjaCk7CiAgICAgICAgICAgIHNzID4+IG51bTsKICAgICAgICAgICAgYXJyLnB1c2hfYmFjayhudW0pOwogICAgICAgIH0KICAgIH0KCiAgICBpbnQgcmVzdWx0ID0gbWlzc2luZ19wb3NpdGl2ZV9pbnRlZ2VyKGFycik7CiAgICBjb3V0IDw8IHJlc3VsdCA8PCBlbmRsOwoKICAgIHJldHVybiAwOwp9Cg=="
            },
            "c": {
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgoKaW50IG1pc3NpbmdfcG9zaXRpdmVfaW50ZWdlcihpbnQgYXJyW10sIGludCBuKSB7CiAgICAvL3dyaXRlIHlvdXIgY29kZSBoZXJlCn0KCmludCBtYWluKCkgewogICAgY2hhciBpbnB1dFsxMDAwXTsKICAgIGZnZXRzKGlucHV0LCBzaXplb2YoaW5wdXQpLCBzdGRpbik7CgogICAgaW50IGFyclsxMDBdLCBuID0gMDsKICAgIGNoYXIgKnRva2VuID0gc3RydG9rKGlucHV0LCAiICxbXVxuIik7CiAgICB3aGlsZSAodG9rZW4gIT0gTlVMTCkgewogICAgICAgIGFycltuKytdID0gYXRvaSh0b2tlbik7CiAgICAgICAgdG9rZW4gPSBzdHJ0b2soTlVMTCwgIiAsW11cbiIpOwogICAgfQoKICAgIGludCByZXN1bHQgPSBtaXNzaW5nX3Bvc2l0aXZlX2ludGVnZXIoYXJyLCBuKTsKICAgIHByaW50ZigiJWRcbiIsIHJlc3VsdCk7CgogICAgcmV0dXJuIDA7Cn0K"
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC4qOwoKcHVibGljIGNsYXNzIE1haW4gewogICAgcHVibGljIHN0YXRpYyBpbnQgbWlzc2luZ1Bvc2l0aXZlSW50ZWdlcihpbnRbXSBhcnIpIHsKICAgICAgICAvL3dyaXRlIHlvdXIgY29kZSBoZXJlCiAgICB9CgogICAgcHVibGljIHN0YXRpYyB2b2lkIG1haW4oU3RyaW5nW10gYXJncykgewogICAgICAgIFNjYW5uZXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKFN5c3RlbS5pbik7CiAgICAgICAgU3RyaW5nIGlucHV0ID0gc2Nhbm5lci5uZXh0TGluZSgpLnJlcGxhY2VBbGwoIltcXFtcXF1dIiwgIiIpOwogICAgICAgIHNjYW5uZXIuY2xvc2UoKTsKCiAgICAgICAgTGlzdDxJbnRlZ2VyPiBhcnJMaXN0ID0gbmV3IEFycmF5TGlzdDw+KCk7CiAgICAgICAgZm9yIChTdHJpbmcgbnVtIDogaW5wdXQuc3BsaXQoIiwiKSkgewogICAgICAgICAgICBhcnJMaXN0LmFkZChJbnRlZ2VyLnBhcnNlSW50KG51bS50cmltKCkpKTsKICAgICAgICB9CgogICAgICAgIGludFtdIGFyciA9IGFyckxpc3Quc3RyZWFtKCkubWFwVG9JbnQoaSAtPiBpKS50b0FycmF5KCk7CiAgICAgICAgaW50IHJlc3VsdCA9IG1pc3NpbmdQb3NpdGl2ZUludGVnZXIoYXJyKTsKICAgICAgICBTeXN0ZW0ub3V0LnByaW50bG4ocmVzdWx0KTsKICAgIH0KfQo="
            }
        },
        // not used in the code
        21: {
            "python": {
                "id": 100,
                "name": "Python",
                "template": "ZGVmIGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGFycik6CiAgICAjIHdyaXRlIHlvdXIgY29kZSBoZXJlCiAgICByZXR1cm4gMCAgCgppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOgogICAKICAgIGlucHV0X3N0ciA9IGlucHV0KCkuc3RyaXAoKQogICAgCiAgICAKICAgIGFyciA9IGxpc3QobWFwKGludCwgaW5wdXRfc3RyLnNwbGl0KCIsIikpKQogICAgCiAgICByZXN1bHQgPSBsYXJnZXN0X251bWJlcl9pbl9hcnJheShhcnIpCiAgICBwcmludChyZXN1bHQpCg=="
            },
            "cpp": {
                "id": 105,
                "name": "C++",
                "template": "I2luY2x1ZGUgPGlvc3RyZWFtPgojaW5jbHVkZSA8c3N0cmVhbT4KI2luY2x1ZGUgPHZlY3Rvcj4KdXNpbmcgbmFtZXNwYWNlIHN0ZDsKCi8vIEZ1bmN0aW9uIHRvIGZpbmQgdGhlIGxhcmdlc3QgbnVtYmVyIGluIGFuIGFycmF5CmludCBsYXJnZXN0X251bWJlcl9pbl9hcnJheSh2ZWN0b3I8aW50PiYgYXJyKSB7CiAgICByZXR1cm4gMDsKfQoKaW50IG1haW4oKSB7CiAgICBzdHJpbmcgaW5wdXQ7CiAgICBnZXRsaW5lKGNpbiwgaW5wdXQpOyAgLy8gUmVhZCBpbnB1dCBhcyBhIHN0cmluZwoKICAgIHZlY3RvcjxpbnQ+IGFycjsKICAgIHN0cmluZ3N0cmVhbSBzcyhpbnB1dCk7CiAgICBzdHJpbmcgdG9rZW47CgogICAgd2hpbGUgKGdldGxpbmUoc3MsIHRva2VuLCAnLCcpKSB7CiAgICAgICAgYXJyLnB1c2hfYmFjayhzdG9pKHRva2VuKSk7ICAvLyBDb252ZXJ0IHN0cmluZyB0b2tlbiB0byBpbnRlZ2VyCiAgICB9CgogICAgaW50IHJlc3VsdCA9IGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGFycik7CiAgICBjb3V0IDw8IHJlc3VsdCA8PCBlbmRsOwoKICAgIHJldHVybiAwOwp9Cg=="
            },
            "java": {
                "id": 96,
                "name": "Java",
                "template": "aW1wb3J0IGphdmEudXRpbC5TY2FubmVyOwoKcHVibGljIGNsYXNzIE1haW4gewogICAgcHVibGljIHN0YXRpYyBpbnQgbGFyZ2VzdF9udW1iZXJfaW5fYXJyYXkoaW50W10gX2FfKSB7CiAgICAgICAgcmV0dXJuIDA7CiAgICB9CgogICAgcHVibGljIHN0YXRpYyB2b2lkIG1haW4oU3RyaW5nW10gYXJncykgewogICAgICAgIFNjYW5uZXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKFN5c3RlbS5pbik7CiAgICAgICAgCiAgICAgICAgLy8gUmVhZCB0aGUgaW5wdXQgYXJyYXkgYXMgYSBzdHJpbmcKICAgICAgICBTdHJpbmcgaW5wdXQgPSBzY2FubmVyLm5leHRMaW5lKCk7CiAgICAgICAgCiAgICAgICAgLy8gQ29udmVydCB0aGUgaW5wdXQgc3RyaW5nIGludG8gYW4gaW50ZWdlciBhcnJheQogICAgICAgIFN0cmluZ1tdIGlucHV0QXJyID0gaW5wdXQuc3BsaXQoIiwiKTsKICAgICAgICBpbnRbXSBfYV8gPSBuZXcgaW50W2lucHV0QXJyLmxlbmd0aF07CiAgICAgICAgCiAgICAgICAgZm9yIChpbnQgaSA9IDA7IGkgPCBpbnB1dEFyci5sZW5ndGg7IGkrKykgewogICAgICAgICAgICBfYV9baV0gPSBJbnRlZ2VyLnBhcnNlSW50KGlucHV0QXJyW2ldLnRyaW0oKSk7IC8vIFRyaW0gdG8gcmVtb3ZlIHNwYWNlcwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiBhbmQgcHJpbnQgdGhlIHJlc3VsdAogICAgICAgIGludCByZXN1bHQgPSBsYXJnZXN0X251bWJlcl9pbl9hcnJheShfYV8pOwogICAgICAgIFN5c3RlbS5vdXQucHJpbnRsbihyZXN1bHQpOwoKICAgICAgICBzY2FubmVyLmNsb3NlKCk7CiAgICB9Cn0K"
            },
            "c": {
                "id": 104,
                "name": "C",
                "template": "I2luY2x1ZGUgPHN0ZGlvLmg+CiNpbmNsdWRlIDxzdGRsaWIuaD4KI2luY2x1ZGUgPHN0cmluZy5oPgoKLy8gRnVuY3Rpb24gdG8gZmluZCB0aGUgbGFyZ2VzdCBudW1iZXIgaW4gYW4gYXJyYXkKaW50IGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGludCBhcnJbXSwgaW50IHNpemUpIHsKICAgIC8vd3JpdGUgeW91ciBjb2RlIGhlcmUKICAgIHJldHVybiAwOwp9CgppbnQgbWFpbigpIHsKICAgIGNoYXIgaW5wdXRbMTAwMF07ICAKICAgIGZnZXRzKGlucHV0LCBzaXplb2YoaW5wdXQpLCBzdGRpbik7CgogICAgaW50IGFyclsxMDBdLCBzaXplID0gMDsKICAgIGNoYXIgKnRva2VuID0gc3RydG9rKGlucHV0LCAiLCIpOyAKCiAgICB3aGlsZSAodG9rZW4gIT0gTlVMTCkgewogICAgICAgIGFycltzaXplKytdID0gYXRvaSh0b2tlbik7IAogICAgICAgIHRva2VuID0gc3RydG9rKE5VTEwsICIsIik7CiAgICB9CgogICAgaW50IHJlc3VsdCA9IGxhcmdlc3RfbnVtYmVyX2luX2FycmF5KGFyciwgc2l6ZSk7CiAgICBwcmludGYoIiVkXG4iLCByZXN1bHQpOwoKICAgIHJldHVybiAwOwp9Cg=="
            }
        }
    }
    return defTemplates[language_id];
}
