const { useState, useEffect, useRef } = React;

const useIntersectionObserver = (options) => {
    const [elements, setElements] = useState([]);
    
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, options);
        
        elements.forEach(el => observer.observe(el));
        
        return () => observer.disconnect();
    }, [elements, options]);
    
    return [setElements];
};

const Navbar = ({ toggleTheme, isDark }) => {
    const [mobileMenu, setMobileMenu] = useState(false);

    const toggleMenu = () => {
        const navLinks = document.querySelector('.nav-links');
        const isFlex = navLinks.style.display === 'flex';
        navLinks.style.display = isFlex ? 'none' : 'flex';
        
        if (!isFlex) {
            Object.assign(navLinks.style, {
                flexDirection: 'column',
                position: 'absolute',
                top: '44px',
                left: '0',
                width: '100%',
                background: 'var(--bg-page)',
                padding: '20px',
                borderBottom: '1px solid var(--border)'
            });
        }
        setMobileMenu(!mobileMenu);
    };

    return (
        <nav className="nav-bar">
            <div className="nav-content">
                <a href="#" className="nav-logo">MediCare<span style={{color: 'var(--accent)'}}>Pro</span></a>
                <div className="nav-links">
                    <a href="#features">Features</a>
                    <a href="#process">Process</a>
                    <a href="#security">Security</a>
                    <a href="#contact">Contact</a>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                    <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Dark Mode">
                        <ion-icon name={isDark ? "sunny-outline" : "moon-outline"} style={{fontSize: '20px'}}></ion-icon>
                    </button>
                    <a href="#upload" className="nav-btn">Get Started</a>
                    <div className="mobile-toggle" onClick={toggleMenu} style={{cursor: 'pointer', fontSize: '24px', display: 'none'}}>
                        <ion-icon name="menu-outline"></ion-icon>
                    </div>
                </div>
            </div>
        </nav>
    );
};

const Hero = () => {
    return (
        <section className="hero fade-up">
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

const Features = () => {
    return (
        <section id="features" className="features">
            <div className="grid-container">
                <div className="grid-item large-item fade-up">
                    <div className="item-content">
                        <h3>AI-Powered Analysis</h3>
                        <p>Instant preliminary screening of your medical reports using state-of-the-art machine learning models.</p>
                    </div>
                    <div style={{marginTop: '20px', fontSize: '40px', color: 'var(--accent)'}}>
                        <ion-icon name="pulse-outline"></ion-icon>
                    </div>
                </div>
                <div className="grid-item dark-item fade-up">
                    <div className="item-content">
                        <h3>End-to-End Encryption</h3>
                        <p>Your data is encrypted before it leaves your device.</p>
                    </div>
                    <div style={{marginTop: '20px', fontSize: '40px'}}>
                        <ion-icon name="lock-closed-outline"></ion-icon>
                    </div>
                </div>
                <div className="grid-item fade-up">
                    <div className="item-content">
                        <h3>Expert Review</h3>
                        <p>Verified specialists validate every AI finding.</p>
                    </div>
                    <div style={{marginTop: '20px', fontSize: '40px', color: '#34c759'}}>
                        <ion-icon name="medkit-outline"></ion-icon>
                    </div>
                </div>
            </div>
        </section>
    );
};

const UploadSection = () => {
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, uploading, success
    const fileInputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            addFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            addFiles(e.target.files);
        }
    };

    const addFiles = (newFiles) => {
        const filesArr = Array.from(newFiles);
        setFiles(prev => [...prev, ...filesArr]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (files.length === 0) {
            alert("Please upload a file.");
            return;
        }

        setStatus('uploading');
        await new Promise(r => setTimeout(r, 2000));
        setStatus('success');
        
        setTimeout(() => {
            setStatus('idle');
            setFiles([]);
        }, 3000);
    };

    return (
        <section id="upload" className="upload-section">
            <div className="container">
                <div className="section-header fade-up">
                    <h2 className="fade-in">Secure Upload</h2>
                    <p className="fade-in">Upload your medical reports for instant analysis.</p>
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
                            id="dropZone"
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current.click()}
                        >
                            <div className="upload-icon">
                                <ion-icon name="cloud-upload-outline" style={{fontSize: '48px'}}></ion-icon>
                            </div>
                            <span className="drop-title">
                                {files.length > 0 ? `${files.length} file(s) added` : "Click or Drag files to upload"}
                            </span>
                            <span className="drop-subtitle" style={{display: 'block', marginTop: '8px'}}>
                                Supports PDF, JPG, PNG (Max 50MB)
                            </span>
                            <input 
                                type="file" 
                                id="fileInput" 
                                ref={fileInputRef} 
                                style={{display: 'none'}} 
                                multiple 
                                onChange={handleChange} 
                            />
                        </div>

                        <div className="file-list">
                            {files.map((f, i) => (
                                <div key={i} className="file-row">
                                    <span>{f.name}</span>
                                    <span style={{color: 'var(--text-secondary)', fontSize: '12px'}}>
                                        {(f.size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                </div>
                            ))}
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-primary btn-block"
                            disabled={status !== 'idle'}
                            style={status === 'success' ? {background: '#34c759'} : {}}
                        >
                            {status === 'idle' && "Analyze Reports"}
                            {status === 'uploading' && "Encrypting & Sending..."}
                            {status === 'success' && "Sent Successfully"}
                        </button>
                    </form>
                </div>
            </div>
        </section>
    );
};

const HealthTips = () => {
    const tips = [
        "Stay hydrated: Drink at least 8 glasses of water a day.",
        "Get enough sleep: 7-9 hours is recommended for adults.",
        "Exercise regularly: Aim for 30 minutes of moderate activity daily.",
        "Eat a balanced diet tailored to your metabolic needs."
    ];
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setIndex(prev => (prev + 1) % tips.length);
        }, 4000);
        return () => clearInterval(timer);
    }, []);

    return (
        <section className="health-tips-section">
            <div className="tips-container">
                <div className="tip-icon">
                    <ion-icon name="heart" style={{fontSize: '24px'}}></ion-icon>
                </div>
                <div className="tips-wrapper">
                    <span className="tips-label">Health Tip</span>
                    <div className="tips-carousel">
                         {tips.map((tip, i) => (
                            <div key={i} className={`tip-item ${i === index ? 'active' : ''}`}>
                                {tip}
                            </div>
                         ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

const Footer = () => (
    <footer>
        <div className="container footer-content">
            <div> 2026 MediCare Pro. All rights reserved.</div>
            <div className="footer-links">
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
            </div>
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
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    return (
        <React.Fragment>
            <Navbar toggleTheme={toggleTheme} isDark={isDark} />
            <Hero />
            <Features />
            <UploadSection />
            <HealthTips />
            <Footer />
        </React.Fragment>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
