const { useState, useEffect, useRef } = React;

const Navbar = ({ toggleTheme, isDark }) => {
    const [mobileMenu, setMobileMenu] = useState(false);
    const toggleMenu = () => setMobileMenu(!mobileMenu);

    return (
        <nav className="nav-bar">
            <div className="nav-content">
                <a href="#" className="nav-logo">
                    <ion-icon name="analytics-outline" style={{color: 'var(--accent)', fontSize: '24px'}}></ion-icon>
                    <span>Neuro<span style={{color: 'var(--accent)'}}>cyn</span></span>
                </a>
                <div className={`nav-links ${mobileMenu ? 'active' : ''}`} style={mobileMenu ? {
                    display: 'flex', flexDirection: 'column', position: 'absolute', top: '70px', left: '0', width: '100%',
                    background: 'var(--bg-card)', padding: '24px', borderRadius: '24px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid var(--border)'
                } : {}}>
                    <a href="#features">Features</a>
                    <a href="#process">Process</a>
                    <a href="#security">Security</a>
                    <a href="#contact">Contact</a>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Dark Mode">
                        <ion-icon name={isDark ? "sunny-outline" : "moon-outline"} style={{fontSize: '20px'}}></ion-icon>
                    </button>
                    <a href="#upload" className="nav-btn" style={{color: isDark ? '#000' : '#fff'}}>Get Started</a>
                    <div className="mobile-toggle" onClick={toggleMenu} style={{cursor: 'pointer', fontSize: '24px', display: 'none', marginLeft: '8px'}}>
                        <ion-icon name="menu-outline"></ion-icon>
                    </div>
                </div>
            </div>
        </nav>
    );
};

const NeuralBackground = ({ type = 'network' }) => {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        const parent = canvas.parentElement;
        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];
        
        const resize = () => {
            width = canvas.width = parent.clientWidth;
            height = canvas.height = parent.clientHeight;
        };
        
        const createParticles = () => {
            particles = [];
            // Adjust particle count based on area size
            const area = width * height;
            const count = Math.floor(area / 15000); 
            
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * (type === 'molecular' ? 0.3 : 0.5),
                    vy: (Math.random() - 0.5) * (type === 'molecular' ? 0.3 : 0.5),
                    radius: type === 'molecular' ? Math.random() * 3 + 2 : Math.random() * 2 + 1
                });
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            
            // Update and draw particles
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                
                // Bounce off edges
                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;
                
                ctx.beginPath();
                if (type === 'molecular') {
                    ctx.rect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
                } else {
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                }
                ctx.fillStyle = accentColor;
                ctx.globalAlpha = type === 'molecular' ? 0.2 : 0.4;
                ctx.fill();
            });
            
            // Draw connections
            particles.forEach((p1, i) => {
                particles.slice(i + 1).forEach(p2 => {
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const maxDist = type === 'molecular' ? 200 : 150;
                    
                    if (dist < maxDist) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = accentColor;
                        ctx.globalAlpha = (1 - dist / maxDist) * (type === 'molecular' ? 0.3 : 1);
                        ctx.lineWidth = type === 'molecular' ? 0.8 : 0.5;
                        ctx.stroke();
                    }
                });
            });
            
            requestAnimationFrame(draw);
        };

        window.addEventListener('resize', () => { resize(); createParticles(); });
        resize();
        createParticles();
        draw();
        
        return () => window.removeEventListener('resize', resize);
    }, [type]);

    return <canvas ref={canvasRef} style={{position: 'absolute', top: 0, left: 0, zIndex: -1, width: '100%', height: '100%', opacity: 0.5}} />;
};

const Hero = () => {
    return (
        <section className="hero fade-up" style={{position: 'relative'}}>
            <NeuralBackground type="network" />
            <div className="hero-content">
                <h1>Next-Gen Medical<br/>Consultation</h1>
                <p>Advanced diagnostics powered by AI, reviewed by top specialists. Secure, fast, and reliable.</p>
                <div className="hero-actions">
                    <a href="#upload" className="btn btn-primary">Start Consultation</a>
                    <a href="#features" className="link">Learn more <span className="arrow"></span></a>
                </div>
            </div>
        </section>
    );
};

const StatsStrip = () => {
    const [counts, setCounts] = useState({ scans: 0, uptime: 0, experts: 0 });

    useEffect(() => {
        const interval = setInterval(() => {
            setCounts(prev => ({
                scans: prev.scans < 10000 ? prev.scans + 123 : 10000,
                uptime: prev.uptime < 99.9 ? prev.uptime + 1.1 : 99.9,
                experts: prev.experts < 24 ? prev.experts + 1 : 24
            }));
        }, 50);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="stats-strip fade-up">
            <div className="stats-container">
                <div className="stat-box">
                    <span className="stat-number">{counts.scans.toLocaleString()}+</span>
                    <span className="stat-label">Scans Analyzed</span>
                </div>
                <div className="stat-box">
                    <span className="stat-number">{counts.uptime.toFixed(1)}%</span>
                    <span className="stat-label">Encryption Uptime</span>
                </div>
                <div className="stat-box">
                    <span className="stat-number">{counts.experts}/7</span>
                    <span className="stat-label">Specialist Access</span>
                </div>
            </div>
        </div>
    );
};

const ProcessWorkflow = () => {
    return (
        <section id="process" className="process-section">
            <div className="process-container">
                <div className="section-header fade-up">
                    <h2>The Synapse Workflow</h2>
                    <p>Seamlessly connecting your data to expert insights.</p>
                </div>
                
                <div className="process-steps">
                    <div className="process-line fade-up"></div>

                    <div className="process-step fade-up" style={{transitionDelay: '0.1s'}}>
                        <div className="step-icon-wrapper">
                            <ion-icon name="cloud-upload-outline"></ion-icon>
                        </div>
                        <h3 className="step-title">1. Secure Upload</h3>
                        <p className="step-desc">Your medical data is encrypted instantly upon upload.</p>
                    </div>
                    
                    <div className="process-step fade-up" style={{transitionDelay: '0.2s'}}>
                        <div className="step-icon-wrapper">
                            <ion-icon name="scan-outline"></ion-icon>
                        </div>
                        <h3 className="step-title">2. AI Neural Scan</h3>
                        <p className="step-desc">Our algorithms analyze patterns to detect anomalies.</p>
                    </div>
                    
                    <div className="process-step fade-up" style={{transitionDelay: '0.3s'}}>
                        <div className="step-icon-wrapper">
                            <ion-icon name="document-text-outline"></ion-icon>
                        </div>
                        <h3 className="step-title">3. Expert Diagnosis</h3>
                        <p className="step-desc">Specialists review the AI findings for final validation.</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

const Features = () => (
    <section id="features" className="features">
        <NeuralBackground />
        <div className="grid-container" style={{position: 'relative', zIndex: 1}}>
            <div className="grid-item fade-up">
                <div className="feature-icon-box">
                    <ion-icon name="pulse-outline"></ion-icon>
                </div>
                <div className="item-content">
                    <h3>AI-Powered Analysis</h3>
                    <p>Instant preliminary screening of your medical reports using state-of-the-art machine learning models.</p>
                </div>
            </div>
            <div className="grid-item fade-up">
                <div className="feature-icon-box">
                    <ion-icon name="lock-closed-outline"></ion-icon>
                </div>
                <div className="item-content">
                    <h3>End-to-End Encryption</h3>
                    <p>Your data is encrypted before it leaves your device, ensuring complete privacy and security.</p>
                </div>
            </div>
            <div className="grid-item fade-up">
                <div className="feature-icon-box">
                    <ion-icon name="medkit-outline"></ion-icon>
                </div>
                <div className="item-content">
                    <h3>Expert Review</h3>
                    <p>Verified neuro specialists validate every AI finding to prevent false positives.</p>
                </div>
            </div>
        </div>
    </section>
);

const UploadSection = () => {
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, uploading, analyzing, success, error
    const [analysis, setAnalysis] = useState(null);
    const fileInputRef = useRef(null);

    const API_KEY = "AIzaSyANU7OmN3iozwoL32NvRpF0nzs9DsbZ6s4"; 

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
        else if (e.type === 'dragleave') setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) addFiles(e.dataTransfer.files);
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files[0]) addFiles(e.target.files);
    };

    const addFiles = (newFiles) => {
        const filesArr = Array.from(newFiles);
        setFiles(prev => [...prev, ...filesArr]);
        setAnalysis(null);
    };

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (files.length === 0) {
            alert("Please upload a report file (PDF or Image).");
            return;
        }

        setStatus('uploading');
        
        try {
            await new Promise(r => setTimeout(r, 1000));
            
            setStatus('analyzing');
            const file = files[0];
            const base64Data = await fileToBase64(file);
            const mimeType = file.type || 'application/pdf';

            const prompt = `
                You are an expert neurologist. Analyze the provided medical report. 
                Generate a comprehensive health assessment in this strict JSON format:
                {
                    "summary": "Detailed professional summary.",
                    "care": ["Step 1", "Step 2"],
                    "medicine": ["Medication Name - Dosage - Frequency (Disclaimer: Consult doctor)"],
                    "lifestyle": ["Recommendation 1", "Recommendation 2"],
                    "swot": {
                        "strengths": ["Item 1", "Item 2"],
                        "weaknesses": ["Item 1", "Item 2"],
                        "opportunities": ["Item 1", "Item 2"],
                        "threats": ["Item 1", "Item 2"]
                    },
                    "graph": [
                        {"label": "Metric Name", "score": 80}
                    ]
                }
                Ensure 'graph' has 4 metrics with scores 0-100. Return ONLY the JSON object. No markdown.
            `;

            // Fallback model list
            const models = ['gemini-2.0-flash-exp', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
            let response, result, errorMsg;

            for (const model of models) {
                try {
                    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            "contents": [{
                                "parts": [
                                    { "text": prompt },
                                    {
                                        "inline_data": {
                                            "mime_type": mimeType,
                                            "data": base64Data
                                        }
                                    }
                                ]
                            }],
                            "generationConfig": { "response_mime_type": "application/json" }
                        })
                    });
                    
                    result = await response.json();
                    if (response.ok) {
                        console.log(`Success with model: ${model}`);
                        break; // Success!
                    }
                    errorMsg = result.error?.message;
                } catch (e) {
                    errorMsg = e.message;
                }
            }
            
            if (!response?.ok) {
                 throw new Error(errorMsg || `All models failed.`);
            }
            
            let textResponse = result.candidates[0].content.parts[0].text;
            
            // Robust JSON cleanup
            textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            // Find actual JSON start/end in case of preamble
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) textResponse = jsonMatch[0];
            
            let analysisData;
            try {
                analysisData = JSON.parse(textResponse);
            } catch (e) {
                console.error("JSON Parse Error. Raw text:", textResponse);
                throw new Error("Failed to parse AI response. See console.");
            }

            setAnalysis(analysisData);
            setStatus('success');

        } catch (error) {
            console.error("Full Error Object:", error);
            setStatus('error');
            alert("Analysis failed: " + error.message);
        }
    };

    const renderList = (items) => {
        if (!items) return null;
        return items.map((item, i) => <li key={i}>{item}</li>);
    };

    const renderSwot = (items) => {
        if (!items) return null;
        return items.slice(0, 2).map((s, i) => <li key={i}>{s}</li>);
    };

    return (
        <section id="upload" className="upload-section">
            <div className="container">
                <div className="section-header fade-up">
                    <h2>Secure Upload</h2>
                    <p>Upload your reports for instant AI-powered analysis.</p>
                </div>
                <div className="glass-panel fade-up">
                    <form id="uploadForm" onSubmit={handleSubmit}>
                        <div className="input-grid">
                            <div className="input-group">
                                <label>Full Name</label>
                                <input type="text" placeholder="John Doe" required />
                            </div>
                            <div className="input-group">
                                <label>Email Address</label>
                                <input type="email" placeholder="john@example.com" required />
                            </div>
                        </div>
                        <div 
                            className={`drop-zone ${isDragging ? 'dragover' : ''}`}
                            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                            onClick={() => fileInputRef.current.click()}
                        >
                            <div className="upload-icon">
                                {status === 'analyzing' ? <div className="spinner"><ion-icon name="sync-outline" className="spin"></ion-icon></div> : <ion-icon name="cloud-upload-outline" style={{fontSize: '48px'}}></ion-icon>}
                            </div>
                            <span className="drop-title">
                                {files.length > 0 ? `${files.length} file(s) selected` : "Click or Drag files to upload"}
                            </span>
                            <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} />
                        </div>
                        <div className="file-list">
                            {files.map((f, i) => (
                                <div key={i} className="file-row">
                                    <span>{f.name}</span>
                                    <span style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{(f.size/1024/1024).toFixed(2)} MB</span>
                                </div>
                            ))}
                        </div>
                        <button type="submit" className="btn btn-primary btn-block" disabled={status === 'uploading' || status === 'analyzing'}>
                            {status === 'uploading' ? "Uploading..." : status === 'analyzing' ? "Analyzing via Neuro-AI..." : "Analyze Report"}
                        </button>
                    </form>

                    {analysis && (
                        <div className="analysis-results fade-up">
                            <div className="result-header" style={{textAlign: 'center', marginBottom: '30px'}}>
                                <h2 style={{color: 'var(--accent)'}}>Analysis Complete</h2>
                                <p>{analysis.summary}</p>
                            </div>

                            <div className="result-grid">
                                <div className="result-card">
                                    <h3><ion-icon name="stats-chart-outline"></ion-icon> Health Metrics</h3>
                                    <div className="health-graph">
                                        {analysis.graph && analysis.graph.map((item, i) => (
                                            <div key={i} className="graph-bar">
                                                <div className="graph-label">
                                                    <span>{item.label}</span>
                                                    <span>{item.score}%</span>
                                                </div>
                                                <div className="bar-track">
                                                    <div className="bar-fill" style={{width: `${item.score}%`}}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="result-card">
                                    <h3><ion-icon name="analytics-outline"></ion-icon> SWOT Analysis</h3>
                                    <div className="swot-grid">
                                        <div className="swot-box strengths">
                                            <h4>Strengths</h4>
                                            <ul>{renderSwot(analysis.swot && analysis.swot.strengths)}</ul>
                                        </div>
                                        <div className="swot-box weaknesses">
                                            <h4>Weaknesses</h4>
                                            <ul>{renderSwot(analysis.swot && analysis.swot.weaknesses)}</ul>
                                        </div>
                                        <div className="swot-box opportunities">
                                            <h4>Opportunities</h4>
                                            <ul>{renderSwot(analysis.swot && analysis.swot.opportunities)}</ul>
                                        </div>
                                        <div className="swot-box threats">
                                            <h4>Threats</h4>
                                            <ul>{renderSwot(analysis.swot && analysis.swot.threats)}</ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="result-card">
                                    <h3><ion-icon name="medkit-outline"></ion-icon> Care & Meds</h3>
                                    <ul className="list-check">
                                        {renderList(analysis.care)}
                                        {analysis.medicine && analysis.medicine.map((m, i) => <li key={i} style={{color: 'var(--accent)'}}><strong>Rx:</strong> {m}</li>)}
                                    </ul>
                                </div>

                                <div className="result-card">
                                    <h3><ion-icon name="leaf-outline"></ion-icon> Lifestyle</h3>
                                    <ul className="list-check">
                                        {renderList(analysis.lifestyle)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

const HealthTips = () => {
    const cards = [
        { icon: "water-outline", title: "Cognitive Clarity", desc: "Hydration is key. Even 1% dehydration decreases cognitive function and focus." },
        { icon: "moon-outline", title: "Deep Sleep Architecture", desc: "Protect your REM cycles. This is when your brain consolidates memory and clears toxins." },
        { icon: "extension-puzzle-outline", title: "Neuroplasticity", desc: "Learn something new daily to form new neural pathways and keep your brain agile." },
        { icon: "leaf-outline", title: "Brain Foods", desc: "Omega-3s and antioxidants in berries reduce oxidative stress in neural networks." },
        { icon: "pulse-outline", title: "Stress Management", desc: "Chronic stress shrinks the hippocampus. Practice mindfulness to protect memory." },
        { icon: "sunny-outline", title: "Morning Light", desc: "Exposure to sunlight resets your circadian rhythm for better sleep-wake cycles." }
    ];

    // Duplicated for infinite loop
    const carouselItems = [...cards, ...cards];
    const sliderRef = useRef(null);
    const [isDown, setIsDown] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        const slider = sliderRef.current;
        let animationId;
        
        const animate = () => {
            if (!isDown && !isPaused && slider) {
                slider.scrollLeft += 1;
                // Seamless loop reset
                if (slider.scrollLeft >= slider.scrollWidth / 2) {
                    slider.scrollLeft = 0;
                }
            }
            animationId = requestAnimationFrame(animate);
        };
        animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
    }, [isDown, isPaused]);

    const handleMouseDown = (e) => {
        setIsDown(true);
        setStartX(e.pageX - sliderRef.current.offsetLeft);
        setScrollLeft(sliderRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDown(false);
        setIsPaused(false);
    };

    const handleMouseUp = () => {
        setIsDown(false);
    };

    const handleMouseMove = (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - sliderRef.current.offsetLeft;
        const walk = (x - startX) * 2; 
        sliderRef.current.scrollLeft = scrollLeft - walk;
    };

    return (
        <section className="health-tips-section fade-up">
            <div className="health-header">
                <h2>Daily Health Insights</h2>
                <p style={{fontSize: '19px', color: 'var(--text-secondary)'}}>Drag to explore or watch our expert curated tips.</p>
            </div>
            
            <div 
                className="tips-carousel-wrapper"
                ref={sliderRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsPaused(true)}
            >
                <div className="tips-track">
                    {carouselItems.map((card, i) => (
                        <div key={i} className="health-card">
                            <div className="card-number">{String((i % cards.length) + 1).padStart(2, '0')}</div>
                            <div>
                                <div className="card-icon-wrapper">
                                    <ion-icon name={card.icon}></ion-icon>
                                </div>
                                <div className="card-content">
                                    <h3>{card.title}</h3>
                                    <p>{card.desc}</p>
                                </div>
                            </div>
                            <div className="card-footer">
                                <span className="card-action">Read More <ion-icon name="arrow-forward-outline"></ion-icon></span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

const Footer = () => (
    <footer>
        <div className="container footer-content">
            <div> 2026 Neurocyn. All rights reserved.</div>
            <div className="footer-links"><a href="#">Privacy</a><a href="#">Terms</a></div>
        </div>
    </footer>
);

const App = () => {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            setIsDark(true);
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light');
        localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    };

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => entry.isIntersecting && entry.target.classList.add('visible'));
        }, { threshold: 0.1 });
        setTimeout(() => document.querySelectorAll('.fade-up').forEach(el => observer.observe(el)), 100);
        return () => observer.disconnect();
    }, []);

    return (
        <React.Fragment>
            <Navbar toggleTheme={toggleTheme} isDark={isDark} />
            <Hero />
            <StatsStrip />
            <HealthTips />
            <Features />
            <ProcessWorkflow />
            <UploadSection />
            <Footer />
        </React.Fragment>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
