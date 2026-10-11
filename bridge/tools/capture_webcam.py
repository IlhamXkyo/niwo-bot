import cv2
import sys

def capture_webcam(output_path="webcam.jpg"):
    # Initialize the camera (0 is usually the default webcam)
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        sys.exit(1)
        
    # Read a single frame
    ret, frame = cap.read()
    
    if ret:
        cv2.imwrite(output_path, frame)
        print(f"Success: Image saved to {output_path}")
    else:
        print("Error: Could not read frame from webcam.")
        sys.exit(1)
        
    # Release the camera
    cap.release()

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "webcam.jpg"
    capture_webcam(out)
