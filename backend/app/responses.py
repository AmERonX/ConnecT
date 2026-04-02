from fastapi.responses import JSONResponse


def success_response(data, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"data": data})
