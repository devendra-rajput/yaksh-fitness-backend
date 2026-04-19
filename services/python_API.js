const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

class PythonAPIService {

    constructor () {
        this.baseUrl = process.env.PYTHON_API_BASE_URL
    }

    generateModel = async (filePath, data) => {
        console.log("PythonAPIService@generateModel");

        const form = new FormData();

        // 1. Append non-file fields (text, numbers, etc.)
        for (const [key, value] of Object.entries(data)) {
            form.append(key, value);
        }

        try {
            const fileStream = fs.createReadStream(filePath);
            
            form.append("image", fileStream, {
                filename: path.basename(filePath),
                // contentType: 'image/jpeg', 
            });
        } catch (error) {
            console.error(`Error reading local file at ${filePath}:`, error.message);
            return { 
                status: false, 
                message: 'Could not read local file.' 
            };
        }

        const requestConfig = {
            method: 'post',
            url: `${this.baseUrl}/generate`,
            headers: {
                // 'Authorization': 'Bearer YOUR_API_TOKEN_HERE', 
                ...form.getHeaders()
            },
            data: form,
            // maxContentLength: Infinity,
            // maxBodyLength: Infinity,
        };

        try {
            const response = await axios(requestConfig);

            console.log('--- API Response ---');
            console.log(`Status: ${response.status}`);
            console.log('Data:', response.data);
            console.log('--------------------');
            
            return { 
                status: true, 
                data: response.data 
            };
        } 
        catch (error) {
            console.error('Error sending request to third-party API:');
            // console.log(error, "=======error");

            // Log the response data if available (e.g., for 4xx errors)
            if (error.response) {
                console.error(`Status: ${error.response.status}`);
                console.error('Error Data:', error.response.data);
            } else {
                console.error(error.message);
            }
            
            return { 
                status: false, 
                message: error.message || 'API request failed.'
            };
        }
    }
}

module.exports = new PythonAPIService;