window.addEventListener('load', () => {
    // --- 1. CORE CONSTANTS & INITIAL SETUP ---
    const totalTasks = 3;
    const taskPrompts = ["Draw a House", "Draw a Sun", "Draw a Boy"];
    let currentTask = 0;
    
    // Store all user and drawing data
    const userData = {
        name: '',
        age: '',
        profile: '',
        drawings: []
    };

    // Drawing state variables
    let canvas = null;
    let ctx = null;
    let painting = false;
    let strokes = [];
    let lastTime = null;
    let penLifts = 0;
    
    // UI elements to be reused or controlled
    let taskCounter = null;
    let nextBtn = null;
    let submitBtn = null; // Declare submitBtn globally
    let buttonContainer = null;

    // --- 2. DATA PROCESSING FUNCTIONS (Unchanged) ---

    function formatStrokeData(data) {
        let output = "--- USER DATA ---\n";
        output += `Name: ${userData.name}\n`;
        output += `Age: ${userData.age}\n`;
        output += `Development Profile: ${userData.profile}\n\n`;
        output += "--- DRAWING DATA ---\n";
        
        data.forEach((drawing, dIndex) => {
            output += `\nDrawing ${dIndex + 1}: ${taskPrompts[dIndex]}\n`;
            output += `Total Strokes: ${drawing.strokeData.strokes.length}\n`;
            output += `Total Points: ${drawing.strokeData.totalPoints}\n`;
            output += "----------------------------------------\n";
            
            drawing.strokeData.strokes.forEach((s, sIndex) => {
                output += `  Stroke ${sIndex + 1}:\n`;
                output += `    Duration: ${s.duration} ms\n`;
                output += `    Avg Speed: ${s.avgSpeed.toFixed(2)} px/ms\n`;
                output += `    Points Recorded: ${s.points.length}\n`;
            });
            output += "\n";
        });
        return output;
    }

    function downloadFile(data, filename, type) {
        const file = new Blob([data], { type: type });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    
    function downloadImage(dataURL, filename) {
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    window.getStrokeData = () => {
        const data = JSON.parse(JSON.stringify(strokes));
        const totalPoints = data.reduce((sum, s) => sum + s.points.length, 0);
        return { strokes: data, penLifts, totalPoints };
    };


    // --- 3. DRAWING & METRIC LOGIC (Unchanged) ---

    function startPosition(e) {
        if (e.pointerType === 'pen' || e.button === 0) { 
            painting = true;
            lastTime = Date.now();
            strokes.push({ points: [], duration: 0, avgSpeed: 0, totalDistance: 0 });
            draw(e);
        }
    }

    function endPosition() {
        if (!painting) return;
        painting = false;
        penLifts++;

        const s = strokes[strokes.length - 1];
        if (s.points.length > 1) {
            s.duration = s.points[s.points.length - 1].tTotal;
            
            const speeds = [];
            let totalDist = 0;
            
            for (let i = 1; i < s.points.length; i++) {
                const p1 = s.points[i - 1];
                const p2 = s.points[i];
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                totalDist += dist;
                
                const dt = p2.dt;
                if (dt > 0) speeds.push(dist / dt);
            }
            
            s.avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
            s.totalDistance = totalDist;
        }

        ctx.beginPath();
    }

    function draw(e) {
        if (!painting) return;
        
        e.preventDefault(); 
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const pressure = e.pressure || 0.0; 
        const now = Date.now();

        const dt = now - lastTime;
        
        const lastStroke = strokes[strokes.length - 1];
        const tTotal = lastStroke.points.length > 0
            ? lastStroke.points[lastStroke.points.length - 1].tTotal + dt
            : 0;

        lastStroke.points.push({ x, y, pressure, dt, tTotal });
        lastTime = now;

        ctx.lineWidth = pressure > 0 ? pressure * 15 + 5 : 5;
        ctx.strokeStyle = "black";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        ctx.lineTo(x, y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    function setupDrawingListeners() {
        canvas.addEventListener("pointerdown", startPosition);
        canvas.addEventListener("pointerup", endPosition);
        canvas.addEventListener("pointerout", endPosition);
        canvas.addEventListener("pointermove", draw);
    }
    
    function removeDrawingListeners() {
        canvas.removeEventListener("pointerdown", startPosition);
        canvas.removeEventListener("pointerup", endPosition);
        canvas.removeEventListener("pointerout", endPosition);
        canvas.removeEventListener("pointermove", draw);
    }


    // --- 4. UI FLOW MANAGEMENT (FIXED LOGIC) ---

    function updateTaskCounter() {
        taskCounter.textContent = `Drawing Task ${currentTask + 1} of ${totalTasks} — ${taskPrompts[currentTask]}`;
    }

    function saveCurrentDrawing() {
        endPosition(); 
        
        // Only save if a stroke was actually drawn
        if (strokes.length > 0) {
            const strokeData = getStrokeData();
            const pngData = canvas.toDataURL("image/png");

            userData.drawings.push({
                task: taskPrompts[currentTask],
                strokeData,
                png: pngData
            });
        }

        // Reset for the next task
        strokes = [];
        penLifts = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * FIX: Handle the transition from Task 2 (Sun) to Task 3 (Boy).
     * The Submit button must appear immediately after saving the Sun drawing.
     */
    function handleNextTask() {
        // 1. Save the drawing data for the current task
        saveCurrentDrawing();
        
        currentTask++;

        // Check if we are moving to the final task (index 2: "Draw a Boy")
        if (currentTask === totalTasks - 1) { 
            
            // A. Remove the "Next" button
            if (nextBtn) {
                nextBtn.style.display = "none";
                nextBtn.remove(); // Clean up the DOM element
            }

            // B. Create and display the "Submit" button
            submitBtn = document.createElement("button");
            submitBtn.textContent = "Submit";
            // Replicate Next button styles
            submitBtn.style.cssText = `
                font-size: 18px;
                padding: 10px 18px;
                border-radius: 8px;
                cursor: pointer;
                background-color: #28a745; /* Use a different color for emphasis */
                color: white;
                border: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `; 
            
            submitBtn.onclick = handleSubmit;
            buttonContainer.appendChild(submitBtn);
            
            // C. Update the task counter to the final prompt
            updateTaskCounter();

        } else if (currentTask < totalTasks) {
            // If there are more tasks (Task 1 or Task 2), update the prompt
            updateTaskCounter();
        } 
        // Note: No 'else' block needed, as the submit action is handled by the button itself.
    }

    function handleSubmit() {
        // This function is now called when the final Submit button is pressed.
        // It saves the data for the LAST drawing ("Draw a Boy").
        saveCurrentDrawing();
        removeDrawingListeners();
        
        // Hide UI elements
        canvas.style.display = 'none';
        taskCounter.style.display = 'none';
        buttonContainer.style.display = 'none';
        
        showSubmissionPopup();
    }
    
    // --- 5. INITIAL START SCREEN UI (Unchanged) ---

    function createStartScreen() {
        document.body.innerHTML = '';
        document.body.style.display = 'flex';
        document.body.style.justifyContent = 'center';
        document.body.style.alignItems = 'center';
        document.body.style.height = '100vh';
        document.body.style.margin = '0';

        const formContainer = document.createElement('div');
        formContainer.style.padding = '30px';
        formContainer.style.border = '1px solid #ccc';
        formContainer.style.borderRadius = '10px';
        formContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        formContainer.style.background = '#f9f9f9';
        
        const title = document.createElement('h2');
        title.textContent = "Participant Information";
        title.style.textAlign = 'center';
        
        const nameInput = createFormElement('Name:', 'input', { type: 'text', id: 'nameInput' });
        
        const ageDropdown = createFormElement('Age (5-12):', 'select', { id: 'ageDropdown' });
        for (let i = 5; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            ageDropdown.querySelector('select').appendChild(option);
        }
        
        const profileDropdown = createFormElement('Development Profile:', 'select', { id: 'profileDropdown' });
        ['typical', 'delayed'].forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p.charAt(0).toUpperCase() + p.slice(1);
            profileDropdown.querySelector('select').appendChild(option);
        });

        const startBtn = document.createElement('button');
        startBtn.textContent = 'Start Drawing Task';
        startBtn.style.marginTop = '20px';
        startBtn.style.padding = '12px 24px';
        startBtn.style.fontSize = '18px';
        startBtn.style.cursor = 'pointer';
        startBtn.style.width = '100%';
        
        startBtn.onclick = () => {
            const name = document.getElementById('nameInput').value.trim();
            if (!name) {
                alert("Please enter a name to begin.");
                return;
            }
            
            userData.name = name;
            userData.age = document.getElementById('ageDropdown').value;
            userData.profile = document.getElementById('profileDropdown').value;
            
            initializeCanvasAndUI();
        };

        formContainer.appendChild(title);
        formContainer.appendChild(nameInput);
        formContainer.appendChild(ageDropdown);
        formContainer.appendChild(profileDropdown);
        formContainer.appendChild(startBtn);
        document.body.appendChild(formContainer);
    }
    
    function createFormElement(label, type, attrs = {}) {
        const div = document.createElement('div');
        div.style.marginBottom = '15px';

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.display = 'block';
        labelEl.style.marginBottom = '5px';
        
        const inputEl = document.createElement(type);
        Object.assign(inputEl, attrs);
        inputEl.style.width = '100%';
        inputEl.style.padding = '8px';
        inputEl.style.boxSizing = 'border-box';
        inputEl.style.borderRadius = '5px';
        inputEl.style.border = '1px solid #ddd';

        div.appendChild(labelEl);
        div.appendChild(inputEl);
        return div;
    }

    // --- 6. CANVAS & TASK UI SETUP (Modified for Submit Button Creation) ---

    function initializeCanvasAndUI() {
        document.body.innerHTML = '';
        document.body.style.display = 'block';
        document.body.style.padding = '0';
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';

        // 6a. Canvas Setup
        canvas = document.createElement("canvas");
        canvas.id = "canvas";
        document.body.appendChild(canvas);
        ctx = canvas.getContext("2d");

        canvas.height = window.innerHeight; 
        canvas.width = window.innerWidth;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        window.onresize = () => {
            canvas.height = window.innerHeight;
            canvas.width = window.innerWidth;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        };

        // 6b. Task Counter (Prompt)
        taskCounter = document.createElement("p");
        taskCounter.style.cssText = `
            font-size: 28px;
            font-weight: bold;
            text-align: center;
            margin: 10px 0;
            color: #333;
            user-select: none;
        `;
        document.body.insertBefore(taskCounter, canvas);

        // 6c. Buttons Container (Top Right)
        buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = `
            position: absolute;
            top: 15px;
            right: 15px;
            display: flex;
            flex-direction: row;
            gap: 10px;
            z-index: 100;
        `;
        document.body.appendChild(buttonContainer);

        // 6d. Next Button (Only used for tasks 1 and 2)
        nextBtn = document.createElement("button");
        nextBtn.textContent = "Next";
        nextBtn.style.cssText = `
            font-size: 18px;
            padding: 10px 18px;
            border-radius: 8px;
            cursor: pointer;
            background-color: #007bff;
            color: white;
            border: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        nextBtn.onclick = handleNextTask;
        buttonContainer.appendChild(nextBtn);

        // Start the first task
        updateTaskCounter();
        setupDrawingListeners();
    }
    
    // --- 7. FINAL SUBMISSION POPUP & DOWNLOAD (Unchanged) ---
    
    function showSubmissionPopup() {
        const overlay = document.createElement("div");
        overlay.style.cssText = `
            position: fixed; left: 0; top: 0; width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            background-color: rgba(0,0,0,0.6); z-index: 9999;
        `;

        const box = document.createElement("div");
        box.style.cssText = `
            background: #fff; padding: 25px 35px; border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25); text-align: center;
            position: relative; min-width: 350px;
        `;

        const headline = document.createElement("h3");
        headline.textContent = "Drawings Submitted Successfully!";
        headline.style.margin = "0 0 8px 0";

        const message = document.createElement("p");
        message.textContent = "Thank you for completing the drawing tasks. Data is ready for review and download.";
        message.style.margin = "0 0 20px 0";

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.style.cssText = `padding: 8px 16px; font-size: 16px; cursor: pointer;`;
        closeBtn.onclick = () => overlay.remove();

        // View Data Button
        const viewDataBtn = document.createElement("button");
        viewDataBtn.textContent = "View Stroke Data";
        viewDataBtn.style.cssText = `
            position: absolute; bottom: 10px; right: 10px; font-size: 12px;
            padding: 5px 10px; cursor: pointer; border-radius: 6px; opacity: 0.8;
            background-color: #f0f0f0; border: 1px solid #ccc;
        `;

        viewDataBtn.onclick = () => showDataViewer();

        box.appendChild(headline);
        box.appendChild(message);
        box.appendChild(closeBtn);
        box.appendChild(viewDataBtn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }
    
    function showDataViewer() {
        const dataOverlay = document.createElement("div");
        dataOverlay.style.cssText = `
            position: fixed; left: 0; top: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: flex; justify-content: center;
            align-items: center; z-index: 10000;
        `;

        const dataBox = document.createElement("div");
        dataBox.style.cssText = `
            background: #fff; padding: 25px; border-radius: 10px;
            width: 90%; max-width: 1000px; height: 90%;
            display: flex; flex-direction: column;
        `;
        
        // --- DATA VIEW AREA ---
        const dataViewArea = document.createElement('div');
        dataViewArea.style.cssText = `
            display: flex; flex-direction: row; flex-grow: 1; gap: 20px;
            margin-bottom: 15px; overflow: hidden;
        `;
        
        // 1. Text Data (Stroke Metrics)
        const textDataContainer = document.createElement('div');
        textDataContainer.style.cssText = `
            flex: 1; padding: 10px; border: 1px solid #eee; border-radius: 5px;
            overflow: auto; font-family: monospace; white-space: pre-wrap;
            font-size: 14px;
        `;
        const dataText = document.createElement("pre");
        dataText.textContent = formatStrokeData(userData.drawings);
        textDataContainer.appendChild(dataText);
        
        // 2. Image Thumbnails
        const imageGallery = document.createElement('div');
        imageGallery.style.cssText = `
            width: 300px; padding: 10px; border: 1px solid #eee; border-radius: 5px;
            overflow-y: auto; display: flex; flex-direction: column; gap: 15px;
            align-items: center;
        `;
        
        userData.drawings.forEach((drawing, index) => {
            const imgContainer = document.createElement('div');
            imgContainer.style.textAlign = 'center';
            
            const imgLabel = document.createElement('h4');
            imgLabel.textContent = `${index + 1}. ${drawing.task}`;
            imgLabel.style.margin = '0 0 5px 0';
            
            const img = document.createElement('img');
            img.src = drawing.png;
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.border = '1px solid #ccc';
            
            imgContainer.appendChild(imgLabel);
            imgContainer.appendChild(img);
            imageGallery.appendChild(imgContainer);
        });
        
        dataViewArea.appendChild(textDataContainer);
        dataViewArea.appendChild(imageGallery);


        // --- DOWNLOAD & CLOSE BUTTONS ---
        const controlContainer = document.createElement('div');
        controlContainer.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            margin-top: 10px;
        `;
        
        // Download Button
        const downloadAllBtn = document.createElement("button");
        downloadAllBtn.textContent = "Download All Data (.json & PNGs)";
        downloadAllBtn.style.cssText = `
            padding: 10px 18px; font-size: 16px; cursor: pointer;
            background-color: #28a745; color: white; border: none; border-radius: 6px;
        `;
        downloadAllBtn.onclick = () => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const baseFilename = `${userData.name}-${userData.profile}-${timestamp}`;
            
            // 1. Download JSON data
            const jsonData = JSON.stringify(userData, null, 2);
            downloadFile(jsonData, `${baseFilename}-data.json`, 'application/json');
            
            // 2. Download PNGs
            userData.drawings.forEach((drawing, index) => {
                const drawingName = drawing.task.replace(/ /g, '_');
                downloadImage(drawing.png, `${baseFilename}-${drawingName}-${index + 1}.png`);
            });
        };
        
        // Close Button
        const closeDataBtn = document.createElement("button");
        closeDataBtn.textContent = "Close Data Viewer";
        closeDataBtn.style.cssText = `
            padding: 10px 18px; font-size: 16px; cursor: pointer;
            background-color: #dc3545; color: white; border: none; border-radius: 6px;
        `;
        closeDataBtn.onclick = () => dataOverlay.remove();

        controlContainer.appendChild(downloadAllBtn);
        controlContainer.appendChild(closeDataBtn);

        // Assemble Data Box
        dataBox.appendChild(dataViewArea);
        dataBox.appendChild(controlContainer);
        dataOverlay.appendChild(dataBox);
        document.body.appendChild(dataOverlay);
    }

    // Start the application with the initial screen
    createStartScreen();
});