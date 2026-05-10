from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import words, practice, stats

app = FastAPI(title="编程词汇练习")

app.include_router(words.router)
app.include_router(practice.router)
app.include_router(stats.router)

@app.get("/")
def index():
    return FileResponse("static/index.html")

app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=688)
