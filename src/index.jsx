import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // This imports your main logic

// This line finds the <div id="root"></div> in your index.html
// and injects the whole app into it.
ReactDOM.createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)

