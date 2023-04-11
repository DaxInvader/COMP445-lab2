<?php
$target_dir = "segments/";
$target_file = $target_dir . basename($_FILES["segment"]["name"]);
$file = $_FILES['segment']['tmp_name'];

if (move_uploaded_file($_FILES["segment"]["tmp_name"], $target_file)) {
    echo "The file ". htmlspecialchars(basename($_FILES["segment"]["name"])). " has been uploaded.";
} else {
    echo "Sorry, there was an error uploading your file.";
}

// Connect to the MySQL database and update the uploading status
$servername = "localhost";
$username = "root";
$password = "mysql";
$dbname = "lab2";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    die("Connection to MySQL failed: " . $conn->connect_error);
}

$sql = "INSERT INTO video_uploads (filename, status) VALUES ('" . basename($_FILES["segment"]["name"]) . "', 'uploaded')";
if ($conn->query($sql) === TRUE) {
    echo "Video segment added to MYSQL successfully";
} else {
    echo "Error updating uploading status to MYSQL: " . $conn->error;
}

$conn->close();
?>
